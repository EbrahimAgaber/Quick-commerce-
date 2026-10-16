import React from 'react';
import { StoreSettings } from '../../types/store';
import { Sparkles } from 'lucide-react';

interface AnnouncementBarProps {
  settings: StoreSettings;
}

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({ settings }) => {
  if (!settings.announcementText) return null;

  return (
    <div className="bg-stone-900 text-stone-100 text-xs sm:text-sm py-2 px-4 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-center font-medium">
        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>{settings.announcementText}</span>
      </div>
    </div>
  );
};
