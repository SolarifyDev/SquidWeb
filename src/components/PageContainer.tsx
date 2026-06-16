import React from 'react';

// 统一的页面框架：内容表面（page-content-right）上的「居中 + 一致内距」容器。
// 配合「表面 + 卡片」布局——页面不再用整页白卡包裹，列表/分区各自作为卡片浮在表面上。
interface PageContainerProps {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const PageContainer: React.FC<PageContainerProps> = ({ title, actions, children, className }) => {
  return (
    <div className={`mx-auto w-full max-w-[1600px] px-6 sm:px-8 py-6 ${className ?? ''}`}>
      {(title || actions) && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          {title ? (
            <h1 className="m-0 text-2xl font-semibold tracking-[-0.02em] text-slate-900">{title}</h1>
          ) : (
            <span />
          )}
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </div>
  );
};

export default PageContainer;
