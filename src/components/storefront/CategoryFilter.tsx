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
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none my-6">
      <button
        onClick={() => onSelectCategory('all')}
        className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 flex items-center gap-1.5 shadow-xs ${
          activeCategory === 'all'
            ? 'text-white'
            : 'bg-white text-stone-700 hover:bg-stone-50 border'
        }`}
        style={{
          backgroundColor: activeCategory === 'all' ? brand.primaryColor : '#FFFFFF',
          borderColor: brand.neutralColor,
        }}
      >
        <span>جميع المنتجات والخدمات</span>
        <span
          className="text-[11px] px-1.5 py-0.2 rounded-full font-mono"
          style={{
            backgroundColor: activeCategory === 'all' ? 'rgba(255,255,255,0.2)' : brand.neutralColor,
            color: activeCategory === 'all' ? '#FFFFFF' : brand.textColor,
          }}
        >
          {categoryCounts['all'] || 0}
        </span>
      </button>

      {categories.map((cat) => {
        const isActive = activeCategory === cat;
        return (
          <button
            key={cat}
            onClick={() => onSelectCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 flex items-center gap-1.5 shadow-xs ${
              isActive
                ? 'text-white'
                : 'bg-white text-stone-700 hover:bg-stone-50 border'
            }`}
            style={{
              backgroundColor: isActive ? brand.primaryColor : '#FFFFFF',
              borderColor: brand.neutralColor,
            }}
          >
            <span>{cat}</span>
            {categoryCounts[cat] !== undefined && (
              <span
                className="text-[11px] px-1.5 py-0.2 rounded-full font-mono"
                style={{
                  backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : brand.neutralColor,
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
  );
};
