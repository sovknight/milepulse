import { useEffect, useState } from 'preact/hooks';
import { Settings } from './ui/Settings';
import { VehicleDetail } from './ui/VehicleDetail';
import { VehicleList } from './ui/VehicleList';

type Route = { view: 'list' } | { view: 'vehicle'; id: string } | { view: 'settings' };

function parseRoute(hash: string): Route {
  const vehicle = /^#v-([\w-]+)$/.exec(hash);
  if (vehicle) return { view: 'vehicle', id: vehicle[1]! };
  if (hash === '#app-settings') return { view: 'settings' };
  return { view: 'list' };
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseRoute(location.hash));
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);

  return (
    <div class="shell">
      <main class="content">
        {route.view === 'list' && <VehicleList />}
        {route.view === 'vehicle' && <VehicleDetail key={route.id} vehicleId={route.id} />}
        {route.view === 'settings' && <Settings />}
      </main>
      <nav class="tabs" aria-label="Main">
        <a href="#vehicles" class={route.view !== 'settings' ? 'tab active' : 'tab'}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 16a8 8 0 1 1 16 0" />
            <path d="M12 16l4-6" />
          </svg>
          Vehicles
        </a>
        <a href="#app-settings" class={route.view === 'settings' ? 'tab active' : 'tab'}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="8" cy="17" r="2" />
          </svg>
          Settings
        </a>
      </nav>
    </div>
  );
}
