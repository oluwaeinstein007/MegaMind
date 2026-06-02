'use client';

import React from 'react';

interface ItineraryPreviewProps {
  /** original form values or stored prefs */
  preferences: any;
  /** alt. cities from City‑Selector agent */
  recommendations: any[];
  /** itinerary object returned by backend */
  itinerary: any;
  /** raw multi‑agent payload (for insights / tool results) */
  workflowData?: any;
  /**
   * Parent callback – when user clicks a card, we notify
   * so the page can call `/api/quick-plan` (or similar)
   * and then feed the new plan back as props.
   */
  onSelectCity?: (city: string) => void;
}

export function ItineraryPreview({
  preferences,
  recommendations,
  itinerary,
  workflowData,
  onSelectCity
}: ItineraryPreviewProps) {
  console.log('🚨 ITINERARY PREVIEW DEBUG COMPONENT LOADED');
  console.log('Data received:', {
    preferences: !!preferences,
    recommendations: recommendations?.length,
    itinerary: !!itinerary,
    workflowData: !!workflowData,
    itineraryScheduleLength: itinerary?.schedule?.length,
    destination: preferences?.destination || itinerary?.destination
  });

  // Simple test render that should ALWAYS appear
  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: 'lightblue', 
      border: '3px solid red',
      margin: '10px',
      fontSize: '16px'
    }}>
      <h1 style={{ color: 'red', fontSize: '24px', marginBottom: '10px' }}>
        🚨 DEBUG: ITINERARY PREVIEW IS RENDERING
      </h1>
      
      <div style={{ backgroundColor: 'white', padding: '10px', marginBottom: '10px' }}>
        <p><strong>Preferences:</strong> {preferences ? 'YES ✅' : 'NO ❌'}</p>
        <p><strong>Itinerary:</strong> {itinerary ? 'YES ✅' : 'NO ❌'}</p>
        <p><strong>WorkflowData:</strong> {workflowData ? 'YES ✅' : 'NO ❌'}</p>
        <p><strong>Destination:</strong> {preferences?.destination || itinerary?.destination || 'NONE'}</p>
        <p><strong>Schedule Items:</strong> {itinerary?.schedule?.length || 0}</p>
      </div>

      {itinerary?.schedule?.length > 0 && (
        <div style={{ backgroundColor: 'lightyellow', padding: '10px' }}>
          <h2>SCHEDULE DATA EXISTS:</h2>
          <p>First day: {itinerary.schedule[0]?.title || 'No title'}</p>
          <p>Activities: {itinerary.schedule[0]?.activities?.length || 0}</p>
        </div>
      )}

      {itinerary?.localInsights?.length > 0 && (
        <div style={{ backgroundColor: 'lightgreen', padding: '10px' }}>
          <h2>LOCAL INSIGHTS DATA EXISTS:</h2>
          <p>Count: {itinerary.localInsights.length}</p>
          <p>First insight: {itinerary.localInsights[0]?.name || 'No name'}</p>
        </div>
      )}
    </div>
  );
}
