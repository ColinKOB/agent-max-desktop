import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Zap } from 'lucide-react';

const FactBlock = React.memo(function FactBlock({ data }) {
  return (
    <section className="display-card display-block display-block-fact">
      <div className="display-card-label display-block-fact-title">
        <Zap size={14} strokeWidth={1.75} aria-hidden="true" />
        <span>{data.title}</span>
      </div>
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
