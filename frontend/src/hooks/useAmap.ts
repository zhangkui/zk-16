'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

declare global {
  interface Window {
    AMap: any;
    _AMapSecurityConfig: any;
  }
}

const AMAP_KEY = '23d5d9da3a9737f7f45f0469345426b7';
const AMAP_SECURITY_CODE = '16bbfc2770308c172a168326ac633c27';

interface UseAmapOptions {
  onMapReady?: (map: any) => void;
}

export function useAmap(containerId: string, options: UseAmapOptions = {}) {
  const [map, setMap] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<any>(null);

  const loadScript = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      if (window.AMap) {
        resolve();
        return;
      }

      window._AMapSecurityConfig = {
        securityJsCode: AMAP_SECURITY_CODE,
      };

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.PolygonEditor,AMap.AutoComplete,AMap.PlaceSearch,AMap.Geocoder,AMap.ToolBar,AMap.Scale`;
      
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('高德地图加载失败'));

      document.head.appendChild(script);
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    const initMap = async () => {
      try {
        await loadScript();
        
        if (!mounted) return;

        const container = document.getElementById(containerId);
        if (!container) {
          setError('地图容器不存在');
          return;
        }

        const amap = new window.AMap.Map(containerId, {
          zoom: 12,
          center: [116.4074, 39.9042],
          mapStyle: 'amap://styles/normal',
        });

        amap.addControl(new window.AMap.ToolBar({
          position: 'RB',
        }));

        amap.addControl(new window.AMap.Scale({
          position: 'LB',
        }));

        mapRef.current = amap;
        setMap(amap);
        setLoaded(true);

        if (options.onMapReady) {
          options.onMapReady(amap);
        }
      } catch (err: any) {
        setError(err.message);
      }
    };

    initMap();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [containerId, loadScript, options.onMapReady]);

  return { map, loaded, error, mapRef };
}

export default useAmap;
