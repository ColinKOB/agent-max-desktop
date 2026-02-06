/**
 * NewsWidget - Renders news headlines in an editorial stack
 * Design: Story rows with bold title, snippet, and source pill
 */
import React from 'react';

const NewsWidget = React.memo(function NewsWidget({ data }) {
  if (!data || !data.stories || data.stories.length === 0) return null;

  const handleSourceClick = (url) => {
    if (!url) return;
    if (window.electron?.openExternal) {
      window.electron.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="rich-widget rich-widget-news">
      {data.stories.map((story, i) => (
        <div key={i} className="news-story-row">
          <div className="news-story-title">{story.title}</div>
          {story.snippet && (
            <div className="news-story-snippet">{story.snippet}</div>
          )}
          {story.source && (
            <button
              className="news-source-pill"
              onClick={() => handleSourceClick(story.url)}
              title={story.url || story.source}
            >
              {story.source}
            </button>
          )}
        </div>
      ))}
    </div>
  );
});

export default NewsWidget;
