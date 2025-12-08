/**
 * EmailRenderer Component
 * Renders email content with nice formatting, parsing various email formats.
 * Extracted from AppleFloatBar for performance (wrapped in React.memo).
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Mail } from 'lucide-react';

// Helper function to clean text: remove markdown and decode HTML entities
const cleanText = (text) => {
  if (!text) return '';
  return text
    .replace(/\*\*/g, '') // Remove markdown bold
    .replace(/&quot;/g, '"') // Decode HTML quotes
    .replace(/&amp;/g, '&') // Decode ampersand
    .replace(/&lt;/g, '<') // Decode less than
    .replace(/&gt;/g, '>') // Decode greater than
    .replace(/&#39;/g, "'") // Decode apostrophe
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

// Format the date nicely
const formatDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

const EmailRenderer = React.memo(function EmailRenderer({ content }) {
  // Check if content contains email-like patterns (handles markdown bold, emoji, or plain text)
  // Look for "Email Results" or "From:" followed by "Subject:" pattern
  const emailPattern = /Email Results|From:.*Subject:|📧/is;
  const isEmailContent = emailPattern.test(content);

  if (!isEmailContent) {
    // Not email content, render as regular markdown
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => <a target="_blank" rel="noreferrer" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    );
  }

  // Parse email content - handle inline format like "From: X Subject: Y Date: Z Preview: W ID: I"
  const emailBlocks = [];
  let introText = '';

  // Split by lines first
  const lines = content.split('\n').filter((l) => l.trim());

  // Find intro text (first line that doesn't contain email data)
  if (lines.length > 0 && !lines[0].includes('Email Results') && !lines[0].includes('From:')) {
    introText = lines[0].trim();
  }

  // Try to parse inline format: "From: X Subject: Y Date: Z Preview: W ID: I"
  // This handles the format shown in the screenshot
  const inlineEmailRegex =
    /From:\s*([^]*?)(?=Subject:|$)Subject:\s*([^]*?)(?=Date:|$)Date:\s*([^]*?)(?=Preview:|$)Preview:\s*([^]*?)(?=ID:|$)(?:ID:\s*(\S+))?/gi;

  let match;
  const fullContent = content;

  while ((match = inlineEmailRegex.exec(fullContent)) !== null) {
    const email = {
      from: cleanText(match[1]),
      subject: cleanText(match[2]),
      date: cleanText(match[3]),
      preview: cleanText(match[4]), // Don't truncate - show full preview
    };
    // Don't include ID - user doesn't need to see it
    if (email.from || email.subject) {
      emailBlocks.push(email);
    }
  }

  // If inline parsing didn't work, try line-by-line parsing
  if (emailBlocks.length === 0) {
    let currentEmail = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip header lines
      if (
        trimmed.includes('Email Results') ||
        (trimmed.includes('Found') && trimmed.includes('email'))
      ) {
        continue;
      }

      // Start of new email
      const fromMatch = trimmed.match(/^\*?\*?From:?\*?\*?\s*(.+)/i);
      if (fromMatch) {
        if (currentEmail && (currentEmail.from || currentEmail.subject)) {
          emailBlocks.push(currentEmail);
        }
        currentEmail = { from: cleanText(fromMatch[1]) };
        continue;
      }

      if (currentEmail) {
        const subjectMatch = trimmed.match(/^\*?\*?Subject:?\*?\*?\s*(.+)/i);
        const dateMatch = trimmed.match(/^\*?\*?Date:?\*?\*?\s*(.+)/i);
        const previewMatch = trimmed.match(/^\*?\*?Preview:?\*?\*?\s*(.+)/i);

        if (subjectMatch) {
          currentEmail.subject = cleanText(subjectMatch[1]);
        } else if (dateMatch) {
          currentEmail.date = cleanText(dateMatch[1]);
        } else if (previewMatch) {
          currentEmail.preview = cleanText(previewMatch[1]);
        }
        // Skip ID - don't show to user
      }
    }

    if (currentEmail && (currentEmail.from || currentEmail.subject)) {
      emailBlocks.push(currentEmail);
    }
  }

  // If we still couldn't parse any emails, fall back to markdown
  if (emailBlocks.length === 0) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => <a target="_blank" rel="noreferrer" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    );
  }

  return (
    <div>
      {introText && (
        <p style={{ marginBottom: 10, color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
          {introText}
        </p>
      )}

      {emailBlocks.map((email, idx) => (
        <div key={idx} className="email-card">
          {/* Email Header - From & Date */}
          <div className="email-header-row">
            <div className="email-sender">
              <Mail size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
              <span className="email-from-name">{email.from}</span>
            </div>
            {email.date && <span className="email-date">{formatDate(email.date)}</span>}
          </div>

          {/* Subject Line */}
          {email.subject && <div className="email-subject">{email.subject}</div>}

          {/* Preview/Body */}
          {email.preview && <div className="email-body">{email.preview}</div>}
        </div>
      ))}
    </div>
  );
});

export default EmailRenderer;
