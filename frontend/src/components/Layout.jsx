
import Navbar from './common/Navbar';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <Navbar />
      <main className="px-4 sm:px-6 lg:px-8 py-6">{children}</main>
    </div>
  );
}
