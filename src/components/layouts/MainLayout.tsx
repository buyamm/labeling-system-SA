import { ReactNode } from 'react';

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-16 border-b flex items-center px-4">Header</header>
      <main className="flex-1 p-4">
        {children}
      </main>
      <footer className="h-12 border-t flex items-center px-4">Footer</footer>
    </div>
  );
};
