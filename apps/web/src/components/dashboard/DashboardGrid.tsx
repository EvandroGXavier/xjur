import React, { useState } from 'react';
import { Responsive } from 'react-grid-layout';
import { WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardGridProps {
  children: React.ReactNode;
  initialLayouts?: any;
}

export function DashboardGrid({ children, initialLayouts }: DashboardGridProps) {
  const getDefaultLayouts = () => {
    const lg = [
      { i: 'stats', x: 0, y: 0, w: 12, h: 2 },
      { i: 'appointments', x: 0, y: 2, w: 4, h: 4 },
      { i: 'finance_chart', x: 4, y: 2, w: 4, h: 4 },
      { i: 'process_funnel', x: 8, y: 2, w: 4, h: 4 },
    ];
    return {
      lg,
      md: lg.map(item => ({ ...item, w: item.w > 6 ? 10 : 5 })),
      sm: lg.map(item => ({ ...item, w: 6 })),
      xs: lg.map(item => ({ ...item, w: 4 })),
      xxs: lg.map(item => ({ ...item, w: 1 })),
    };
  };

  const [layouts, setLayouts] = useState<any>(() => {
    const saved = localStorage.getItem('drx_dashboard_layouts_v3');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing saved layouts', e);
      }
    }
    return initialLayouts || getDefaultLayouts();
  });

  const handleLayoutChange = (_: any, allLayouts: any) => {
    setLayouts(allLayouts);
    localStorage.setItem('drx_dashboard_layouts_v3', JSON.stringify(allLayouts));
  };

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={layouts}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 1 }}
      rowHeight={100}
      dragConfig={{ handle: '.drag-handle' }}
      onLayoutChange={handleLayoutChange}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return null;
        return (
          <div key={child.props.id} className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-sm group">
            <div className="drag-handle absolute top-2 right-2 p-1 text-slate-600 hover:text-white cursor-move opacity-0 group-hover:opacity-100 transition-opacity z-20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
            </div>
            <div className="h-full w-full relative">
               {child}
            </div>
          </div>
        );
      })}
    </ResponsiveGridLayout>
  );
}
