import { OrchestratorEngine } from './lib/orchestrator-engine';

async function runTest() {
  console.log('🧪 Starting Travel Planner Orchestrator Integration Test...');
  
  const engine = new OrchestratorEngine();
  
  try {
    const result = await engine.execute({
      destination: 'Tokyo',
      budget: 'luxury',
      startDate: '2026-10-10',
      endDate: '2026-10-14',
      travelers: '2 adults',
      interests: 'modern architecture, sushi fine-dining, ancient shrines, and teamLab exhibits',
      comingFrom: 'New York',
    });
    
    console.log('\n=======================================');
    console.log('🎉 ORCHESTRATION COMPLETED!');
    console.log('=======================================');
    console.log('Overall Success:', result.success);
    console.log('Steps executed:', result.orchestration.steps);
    console.log('Execution Time:', result.orchestration.execution_time, 'ms');
    console.log('Task Details:');
    result.workflow_data.tool_results?.forEach((e: any, idx: number) => {
      console.log(`Tool Call #${idx+1}:`, e);
    });
    
    // Print internal structures from workflow_data
    console.log('\n--- Parse Details ---');
    console.log('City selector selected:', result.itinerary.destination);
    console.log('Alternatives count:', result.recommendations.length);
    console.log('Local insights count:', result.itinerary.localInsights.length);
    console.log('Schedule days:', result.itinerary.schedule.length);
    console.log('Logistics Tips:', result.itinerary.logistics?.packingTips?.length || 0);
    console.log('Raw City Selector Output:', JSON.stringify(result.workflow_data.city_analysis).substring(0, 200));
    console.log('Raw Local Insights Output:', JSON.stringify(result.workflow_data.local_insights).substring(0, 200));
    console.log('Raw Travel Logistics Output:', JSON.stringify(result.workflow_data.travel_logistics).substring(0, 200));
    console.log('Raw Booking Curation Output:', JSON.stringify(result.workflow_data.booking_curation).substring(0, 200));
    
    // Verify rich_content is present
    console.log('\n--- Rich Content (Markdown) ---');
    console.log('City Selection markdown:', result.rich_content?.city_selection?.length || 0, 'chars');
    console.log('Local Exploration markdown:', result.rich_content?.local_exploration?.length || 0, 'chars');
    console.log('Itinerary Design markdown:', result.rich_content?.itinerary_design?.length || 0, 'chars');
    console.log('Booking Curation markdown:', result.rich_content?.booking_curation?.length || 0, 'chars');
    console.log('=======================================\n');
    
  } catch (error) {
    console.error('❌ Orchestration test failed with error:', error);
  }
}

runTest();
