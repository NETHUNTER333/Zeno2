import React from 'react';

interface SkeletonProps {
  className?: string;
  isDark?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', isDark = true }) => (
  <div
    aria-hidden="true"
    className={`animate-pulse motion-reduce:animate-none rounded-xl ${
      isDark ? 'bg-white/[0.06]' : 'bg-black/[0.06]'
    } ${className}`}
  />
);

export const RouteSkeleton: React.FC<{ isDark?: boolean }> = ({ isDark = true }) => (
  <div
    className={`flex-1 w-full h-full p-4 sm:p-8 max-w-4xl mx-auto space-y-5 ${
      isDark ? 'text-neutral-400' : 'text-neutral-500'
    }`}
    aria-busy="true"
    aria-label="Loading view"
  >
    <Skeleton isDark={isDark} className="h-8 w-52" />
    <Skeleton isDark={isDark} className="h-28 w-full rounded-2xl" />
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Skeleton isDark={isDark} className="h-36 w-full rounded-2xl" />
      <Skeleton isDark={isDark} className="h-36 w-full rounded-2xl" />
    </div>
    <Skeleton isDark={isDark} className="h-44 w-full rounded-2xl" />
  </div>
);

export const ModalSkeleton: React.FC<{ isDark?: boolean }> = ({ isDark = true }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    aria-busy="true"
    aria-label="Loading dialog"
  >
    <div
      className={`w-full max-w-lg rounded-2xl border p-6 space-y-4 ${
        isDark ? 'bg-[#121215] border-white/10' : 'bg-white border-black/10 shadow-xl'
      }`}
    >
      <Skeleton isDark={isDark} className="h-6 w-44" />
      <Skeleton isDark={isDark} className="h-20 w-full" />
      <Skeleton isDark={isDark} className="h-24 w-full" />
      <div className="flex justify-end gap-2">
        <Skeleton isDark={isDark} className="h-9 w-24" />
        <Skeleton isDark={isDark} className="h-9 w-28" />
      </div>
    </div>
  </div>
);

export const CodeBlockSkeleton: React.FC<{ isDark?: boolean }> = ({ isDark = true }) => (
  <div
    className={`my-2 rounded-xl border p-3.5 space-y-2 ${
      isDark ? 'bg-[#141417] border-white/10' : 'bg-[#f7f7f8] border-black/10'
    }`}
    aria-busy="true"
  >
    <Skeleton isDark={isDark} className="h-3.5 w-24" />
    <Skeleton isDark={isDark} className="h-3.5 w-full" />
    <Skeleton isDark={isDark} className="h-3.5 w-4/5" />
    <Skeleton isDark={isDark} className="h-3.5 w-3/5" />
  </div>
);

export const MessageSkeleton: React.FC<{ isDark?: boolean }> = ({ isDark = true }) => (
  <div className="py-3 space-y-2.5" aria-busy="true">
    <Skeleton isDark={isDark} className="h-4 w-3/4" />
    <Skeleton isDark={isDark} className="h-4 w-full" />
    <Skeleton isDark={isDark} className="h-4 w-5/6" />
  </div>
);

export default Skeleton;
