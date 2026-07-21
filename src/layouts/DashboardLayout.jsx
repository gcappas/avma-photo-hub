import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function DashboardLayout({ user, searchQuery, setSearchQuery }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Header user={user} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
        <div className="content-area">
          {/* Outlet is where the nested routes will render their components */}
          <Outlet />
        </div>
      </div>
    </div>
  );
}
