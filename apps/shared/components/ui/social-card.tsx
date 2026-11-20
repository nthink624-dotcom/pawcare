import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface SocialCardProps {
  label: string;
  author?: {
    name: string;
    avatar: ReactNode;
    dateTime: string;
    dateLabel: string;
    badges?: ReactNode;
  };
  children: ReactNode;
  actions?: ReactNode;
  more?: ReactNode;
  className?: string;
}

export function SocialCard({ label, author, children, actions, more, className }: SocialCardProps) {
  return (
    <article
      aria-label={label}
      data-social-card
      className={cn("min-w-0 rounded-[14px] border border-[#e8edf3] bg-white", className)}
    >
      <div className="space-y-2.5 px-3 py-3 sm:px-4">
        {author && (
          <header className="flex min-w-0 items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              {author.avatar}
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-medium [overflow-wrap:anywhere]">{author.name}</span>
                  {author.badges}
                </div>
                <time dateTime={author.dateTime} className="block text-xs leading-5 text-[#64748b]">
                  {author.dateLabel}
                </time>
              </div>
            </div>
            {more}
          </header>
        )}
        <div className="min-w-0">{children}</div>
      </div>
      {actions && (
        <footer className="flex flex-wrap items-center gap-x-1 gap-y-0.5 border-t border-[#e8edf3] px-2 py-1 sm:px-3">
          {actions}
        </footer>
      )}
    </article>
  );
}
