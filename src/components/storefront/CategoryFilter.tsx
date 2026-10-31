import React from 'react';
import { BrandTheme } from '../../types/store';

interface CategoryFilterProps {
  categories: string[];
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  categoryCounts: Record<string, number>;
  brandTheme?: BrandTheme;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  activeCategory,
  onSelectCategory,
  categoryCounts,
  brandTheme,
}) => {
  const brand = brandTheme || {
    primaryColor: '#0B253F',
    accentColor: '#0077FF',
    highlightColor: '#A5F3B6',
    backgroundColor: '#F8F3ED',
    neutralColor: '#E4E7EB',
    textColor: '#0B253F',
  };

  return (
    <div className="relative my-3 sm:my-5">
      <div 
        className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 px-0.5 -mx-1"
        style={{ scrollSnapType: 'x proximity' }}
      >
        {/* All Products Tab */}
        <button
          type="button"
          onClick={() => onSelectCategory('all')}
          style={{
            backgroundColor: activeCategory === 'all' ? brand.primaryColor : '#FFFFFF',
            borderColor: brand.neutralColor,
            scrollSnapAlign: 'start',
          }}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 flex items-center gap-2 border shadow-2xs active:scale-95 cursor-pointer ${
            activeCategory === 'all'
              ? 'text-white'
              : 'text-stone-700 hover:bg-stone-50'
          }`}
        >
          <span>جميع الأقسام</span>
          <span
            className="text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded-md"
            style={{
              backgroundColor: activeCategory === 'all' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)',
              color: activeCategory === 'all' ? '#FFFFFF' : brand.textColor,
            }}
          >
            {categoryCounts['all'] || 0}
          </span>
        </button>

        {/* Dynamic Categories */}
        {categories.map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onSelectCategory(cat)}
              style={{
                backgroundColor: isActive ? brand.primaryColor : '#FFFFFF',
                borderColor: brand.neutralColor,
                scrollSnapAlign: 'start',
              }}
              className={`min-h-[44px] px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 flex items-center gap-2 border shadow-2xs active:scale-95 cursor-pointer ${
                isActive
                  ? 'text-white'
                  : 'text-stone-700 hover:bg-stone-50'
              }`}
            >
              <span className="whitespace-nowrap">{cat}</span>
              {categoryCounts[cat] !== undefined && (
                <span
                  className="text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded-md"
                  style={{
                    backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)',
                    color: isActive ? '#FFFFFF' : brand.textColor,
                  }}
                >
                  {categoryCounts[cat]}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
