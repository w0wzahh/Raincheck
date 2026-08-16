const GEO='https://geocoding-api.open-meteo.com/v1/search';
export async function searchPlaces(query){
  const u=new URL(GEO);u.searchParams.set('name',query);u.searchParams.set('count','8');u.searchParams.set('language','en');u.searchParams.set('format','json');
  const r=await fetch(u);if(!r.ok)throw new Error('Location search failed');const d=await r.json();return (d.results||[]).map(x=>({id:`${x.id}`,name:x.name,country:x.country||'',admin:x.admin1||'',lat:x.latitude,lon:x.longitude,timezone:x.timezone||'auto'}));
}
export async function reverseGeocode(lat,lon){
  const u=new URL('https://nominatim.openstreetmap.org/reverse');u.searchParams.set('lat',lat);u.searchParams.set('lon',lon);u.searchParams.set('format','json');u.searchParams.set('zoom','10');
  const r=await fetch(u,{headers:{'Accept-Language':'en'}});if(!r.ok)throw new Error('Reverse geocoding failed');const d=await r.json();const a=d.address||{};return {name:a.city||a.town||a.village||a.municipality||a.county||'Current location',country:a.country||'',lat,lon};
}
