import Queue from 'bull';
import { redis, CacheManager, CACHE_KEYS } from './redis';
import { StateGraph } from './state-graph';

// Create job queue with external Redis
const travelPlanningQueue = new Queue('travel planning', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: 0,
    maxRetriesPerRequest: 3,
    connectTimeout: 10000,
    family: 4
  },
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  }
});

// Job types
export interface TravelPlanningJob {
  id: string;
  userId: string;
  preferences: any;
  timestamp: number;
}

export interface JobStatus {
  id: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

// Queue event handlers
travelPlanningQueue.on('ready', () => {
  console.log('✅ Travel planning queue is ready');
});

travelPlanningQueue.on('error', (error) => {
  console.error('❌ Queue error:', error);
});

travelPlanningQueue.on('waiting', (jobId) => {
  console.log(`⏳ Job ${jobId} is waiting`);
});

travelPlanningQueue.on('active', (job) => {
  console.log(`🚀 Job ${job.id} started processing`);
});

travelPlanningQueue.on('completed', (job, result) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

travelPlanningQueue.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err);
});

// Process travel planning jobs
travelPlanningQueue.process('generate-travel-plan', 1, async (job) => {
  const { id, userId, preferences } = job.data as TravelPlanningJob;
  
  try {
    console.log(`🚀 Processing travel planning job: ${id}`);
    
    // Update job status
    await updateJobStatus(id, 'active', 10);
    await job.progress(10);
    
    // Test Redis connection
    const redisConnected = await CacheManager.testConnection();
    if (!redisConnected) {
      throw new Error('Redis connection failed');
    }

    // Initialize StateGraph
    console.log('🔧 Initializing StateGraph...');
    const stateGraph = new StateGraph({
      recursionLimit: 150,
      timeout: 300000,
      enableTools: true
    });

    // Update progress
    await updateJobStatus(id, 'active', 30);
    await job.progress(30);

    console.log('🤖 Executing multi-agent workflow...');
    // Execute multi-agent workflow
    const finalState = await stateGraph.execute(preferences, 'city-selector');

    // Update progress
    await updateJobStatus(id, 'active', 80);
    await job.progress(80);

    console.log('✅ Workflow complete, preparing results...');
    
    // Prepare result
    const result = {
      success: true,
      orchestration: {
        steps: finalState.step,
        agents_executed: Object.keys(finalState.data),
        tool_calls: finalState.toolCalls.length,
        execution_time: (
          (finalState.messages?.[finalState.messages.length - 1]?.timestamp ?? 0) -
          (finalState.messages?.[0]?.timestamp ?? 0)
        )
      },
      recommendations: finalState.data['city-selector']?.alternatives || [],
      itinerary: {
        destination: finalState.data['city-selector']?.selectedCity || preferences.destination,
        localInsights: finalState.data['local-expert']?.insights || [],
        schedule: finalState.data['travel-concierge']?.schedule || [],
        budget: finalState.data['travel-concierge']?.totalBudget || { total: '$0', daily: '$0', breakdown: {} }
      },
      workflow_data: {
        city_analysis: finalState.data['city-selector'],
        local_insights: finalState.data['local-expert'],
        travel_logistics: finalState.data['travel-concierge'],
        tool_results: finalState.toolCalls
      }
    };

    // Cache the result
    await CacheManager.set(CACHE_KEYS.TRAVEL_PLAN(id), result, 86400); // 24 hours

    // Add to user history
    const historyItem = {
      id,
      preferences,
      result,
      createdAt: Date.now()
    };
    await CacheManager.addToList(CACHE_KEYS.USER_HISTORY(userId), historyItem);

    // Update job status
    await updateJobStatus(id, 'completed', 100, result);
    await job.progress(100);

    console.log(`✅ Job ${id} completed successfully`);
    return result;
  } catch (error) {
    console.error(`❌ Background job error for ${id}:`, error);
    const errorMessage = (error instanceof Error) ? error.message : String(error);
    await updateJobStatus(id, 'failed', 0, null, errorMessage);
    throw error;
  }
});

// Job management functions
export async function createTravelPlanningJob(userId: string, preferences: any): Promise<string> {
  const jobId = `travel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`🎯 Creating travel planning job: ${jobId}`);
  
  const jobData: TravelPlanningJob = {
    id: jobId,
    userId,
    preferences,
    timestamp: Date.now()
  };

  try {
    // Test Redis connection first
    const redisConnected = await CacheManager.testConnection();
    if (!redisConnected) {
      throw new Error('Redis connection failed - cannot create background job');
    }

    // Add job to queue
    const job = await travelPlanningQueue.add('generate-travel-plan', jobData, {
      jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    // Initialize job status
    await updateJobStatus(jobId, 'waiting', 0);
    
    console.log(`✅ Job created successfully: ${jobId}`);
    return jobId;
  } catch (error) {
    console.error(`❌ Failed to create job ${jobId}:`, error);
    throw error;
  }
}

export async function getJobStatus(jobId: string): Promise<JobStatus | null> {
  try {
    const status = await CacheManager.get<JobStatus>(CACHE_KEYS.BACKGROUND_JOB(jobId));
    if (status) {
      console.log(`📊 Job status for ${jobId}:`, status.status, `${status.progress}%`);
    }
    return status;
  } catch (error) {
    console.error(`❌ Failed to get job status for ${jobId}:`, error);
    return null;
  }
}

export async function updateJobStatus(
  jobId: string, 
  status: JobStatus['status'], 
  progress: number, 
  result?: any, 
  error?: string
): Promise<void> {
  try {
    const existingStatus = await CacheManager.get<JobStatus>(CACHE_KEYS.BACKGROUND_JOB(jobId));
    
    const jobStatus: JobStatus = {
      id: jobId,
      status,
      progress,
      result,
      error,
      createdAt: existingStatus?.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    await CacheManager.set(CACHE_KEYS.BACKGROUND_JOB(jobId), jobStatus, 86400);
    console.log(`📊 Updated job status: ${jobId} -> ${status} (${progress}%)`);
  } catch (error) {
    console.error(`❌ Failed to update job status for ${jobId}:`, error);
  }
}

export async function getUserHistory(userId: string): Promise<any[]> {
  try {
    const history = await CacheManager.getList(CACHE_KEYS.USER_HISTORY(userId));
    console.log(`📚 Retrieved history for ${userId}: ${history.length} items`);
    return history;
  } catch (error) {
    console.error(`❌ Failed to get user history for ${userId}:`, error);
    return [];
  }
}

// Cleanup old jobs (run periodically)
export async function cleanupOldJobs(): Promise<void> {
  try {
    const jobs = await travelPlanningQueue.getJobs(['completed', 'failed'], 0, -1);
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago

    let cleanedCount = 0;
    for (const job of jobs) {
      if (job.timestamp < cutoff) {
        await job.remove();
        cleanedCount++;
      }
    }
    
    console.log(`🧹 Cleaned up ${cleanedCount} old jobs`);
  } catch (error) {
    console.error('❌ Failed to cleanup old jobs:', error);
  }
}

// Get queue stats
export async function getQueueStats() {
  try {
    const waiting = await travelPlanningQueue.getWaiting();
    const active = await travelPlanningQueue.getActive();
    const completed = await travelPlanningQueue.getCompleted();
    const failed = await travelPlanningQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length
    };
  } catch (error) {
    console.error('❌ Failed to get queue stats:', error);
    return { waiting: 0, active: 0, completed: 0, failed: 0 };
  }
}