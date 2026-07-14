import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const FactBlock = React.memo(function FactBlock({ data }) {
  return (
    <section className="rich-widget display-block display-block-fact">
      <div className="display-block-fact-title">{data.title}</div>
      <div className="display-block-fact-primary">{data.primary}</div>
      {!!data.enrichment && (
        <div className="display-block-fact-enrichment">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ node, ...props }) => (
                <a target="_blank" rel="noreferrer" {...props} />
              ),
            }}
          >
            {data.enrichment}
          </ReactMarkdown>
        </div>
      )}
    </section>
  );
});

export default FactBlock;
