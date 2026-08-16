import {APP_VERSION,weatherInfo} from './core/config.js?v=10.0.1';
import {getSettings,saveSettings,getPlaces,upsertPlace,removePlace,clearPlaces,recordObservation,cacheWeather,getCachedWeather,getLastLocation,setLastLocation} from './core/storage.js?v=10.0.1';
import {searchPlaces,reverseGeocode} from './api/geocoding.js?v=10.0.1';import {fetchWeather,fetchAirQuality} from './api/weather.js?v=10.0.1';import {fetchHistoricalWeek} from './api/history.js?v=10.0.1';
import {buildAlerts,commuteAdvice} from './features/intelligence.js?v=10.0.1';import {enableNotifications,maybeNotify,scheduleBriefing} from './features/notifications.js?v=10.0.1';import {shareWeather,downloadShareCard} from './features/share.js?v=10.0.1';import {initWeatherMap,radarToggle,radarStep,radarSeek,radarState,setRadarPlaybackRate} from './features/map.js?v=10.0.1';import {planAt} from './features/planner.js?v=10.0.1';import {renderAll,renderPlaces,$,$$,safe,fmtTime} from './ui/render.js?v=10.0.1';
const weatherInfoLabel=code=>weatherInfo(code)[0];
const state={version:APP_VERSION,settings:getSettings(),place:null,weather:null,air:null,history:null,offline:false,installPrompt:null};
const els={city:$('#cityInput'),suggestions:$('#suggestions'),weather:$('#weatherContent'),loading:$('#loadingSpinner'),error:$('#errorMessage'),errorText:$('#errorText'),empty:$('#emptyState')};
const toast=msg=>{const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2600)};
const setLoading=v=>els.loading.classList.toggle('hidden',!v);
const setError=m=>{els.error.classList.toggle('hidden',!m);if(m)els.errorText.textContent=m};
const openModal=id=>$('#'+id)?.classList.remove('hidden'),closeModal=id=>$('#'+id)?.classList.add('hidden');
function reportRuntimeError(err){console.error('RainCheck runtime error',err);setLoading(false);if(!state.weather){els.empty.classList.remove('hidden');setError(`RainCheck could not finish loading. ${err?.message||'Try searching for a city or refreshing.'}`)}}
async function loadPlace(place,{cache=true}={}){
 if(!place||!Number.isFinite(Number(place.lat))||!Number.isFinite(Number(place.lon))){setError('That location is missing valid coordinates. Search for the place again.');return}
 place={...place,lat:Number(place.lat),lon:Number(place.lon)};state.place=place;setLastLocation(place);setLoading(true);setError('');els.empty.classList.add('hidden');els.city.value=place.name;
 const key=`${place.lat.toFixed(3)},${place.lon.toFixed(3)}`;
 try{
  const weather=await fetchWeather(place.lat,place.lon);state.weather=weather;state.offline=false;cacheWeather(key,weather);
  try{state.air=await fetchAirQuality(place.lat,place.lon)}catch{state.air=null}
  try{render();}catch(err){reportRuntimeError(err);return}
  // Radar/map is intentionally lazy. Map tiles are expensive on weaker WebViews and
  // the map is below the fold, so loading it during weather startup wastes work.
  if(state.mapReady){try{await initWeatherMap('mapFrame',place.lat,place.lon)}catch(err){console.warn('Map unavailable',err)}}
  loadHistory();const alerts=buildAlerts(weather,state.settings);maybeNotify(alerts,place);scheduleBriefing(place,weather);
 }catch(err){
  const cached=cache?getCachedWeather(key):null;if(cached){state.weather=cached;state.air=null;state.offline=true;try{render();toast('Showing cached weather')}catch(e){reportRuntimeError(e)}}else{els.empty.classList.remove('hidden');setError(err?.name==='AbortError'?'Weather request timed out. Check your connection and try again.':err?.message||'Could not load weather. Search for a city or use your current location.')}}
 finally{setLoading(false)}
}
async function loadHistory(){if(!state.place)return;try{state.history=await fetchHistoricalWeek(state.place.lat,state.place.lon);const d=state.history.daily;if(d?.temperature_2m_mean?.length){const avg=d.temperature_2m_mean.reduce((a,b)=>a+(b||0),0)/d.temperature_2m_mean.length;const rain=(d.precipitation_sum||[]).reduce((a,b)=>a+(b||0),0);$('#historicalSummary').textContent=`Last 7 days · average ${Math.round(avg)}° · ${rain.toFixed(1)} mm precipitation`;renderHistoricalChart()}}catch{$('#historicalSummary').textContent='Historical archive is temporarily unavailable.'}}
function renderHistoricalChart(){const d=state.history?.daily;if(!d?.time?.length)return;const highs=d.temperature_2m_max||[],lows=d.temperature_2m_min||[],means=d.temperature_2m_mean||[],rain=d.precipitation_sum||[],wind=d.wind_speed_10m_max||[],min=Math.min(...lows),max=Math.max(...highs),range=Math.max(1,max-min);const u=state.settings.unit;$('#historicalChart').innerHTML=d.time.slice(0,7).map((t,i)=>{const hi=highs[i]??means[i]??0,lo=lows[i]??means[i]??hi,mean=means[i]??((hi+lo)/2),h=Math.max(16,((hi-min)/range)*100),l=Math.max(8,((lo-min)/range)*100);return `<article class="history-day"><div class="history-head"><span class="history-label">${new Date(t).toLocaleDateString([],{weekday:'short'})}</span><strong class="history-high">${Math.round(u==='metric'?hi:hi*9/5+32)}°</strong></div><div class="history-track"><i class="history-range" style="height:${Math.max(22,h-l)}%;margin-bottom:${Math.min(70,l)}%"></i></div><div><div class="history-low">${Math.round(u==='metric'?lo:lo*9/5+32)}° · avg ${Math.round(u==='metric'?mean:mean*9/5+32)}°</div><div class="history-rain">${Number(rain[i]??0).toFixed(1)} mm · ${Math.round(wind[i]??0)} km/h</div></div></article>`}).join('');const avg=means.length?means.reduce((a,b)=>a+(b||0),0)/means.length:0;const totalRain=rain.reduce((a,b)=>a+(b||0),0);const maxWind=Math.max(...wind,0);$('#historicalStats').innerHTML=`<div class="history-stat"><span>Average temperature</span><strong>${Math.round(u==='metric'?avg:avg*9/5+32)}°</strong></div><div class="history-stat"><span>Total precipitation</span><strong>${totalRain.toFixed(1)} mm</strong></div><div class="history-stat"><span>Peak wind</span><strong>${Math.round(maxWind)} km/h</strong></div>`}
async function locate(){if(!navigator.geolocation){toast('Geolocation is not supported');return}setLoading(true);navigator.geolocation.getCurrentPosition(async p=>{try{await loadPlace(await reverseGeocode(p.coords.latitude,p.coords.longitude))}catch{await loadPlace({name:'Current location',country:'',lat:p.coords.latitude,lon:p.coords.longitude})}},()=>{setLoading(false);toast('Location access was unavailable. Search for a city instead.')},{enableHighAccuracy:true,timeout:12000,maximumAge:60000})}
async function search(){const q=els.city.value.trim();if(q.length<2){toast('Type at least two characters');return}try{const r=await searchPlaces(q);renderSuggestions(r,true);if(r[0])await choose(r[0]);else setError(`No places found for “${q}”.`) }catch{toast('Location search failed')}}
async function choose(p){await loadPlace(p);els.suggestions.classList.add('hidden')}
function renderSuggestions(items,hide=false){els.suggestions.innerHTML=items.map(p=>`<button type="button" class="suggestion" data-lat="${p.lat}" data-lon="${p.lon}" data-name="${safe(p.name)}" data-country="${safe(p.country)}" data-admin="${safe(p.admin)}"><span>${safe(p.name)}</span><small>${safe([p.admin,p.country].filter(Boolean).join(', '))}</small></button>`).join('');els.suggestions.classList.toggle('hidden',!items.length||hide)}
function render(){renderAll(state);recordObservation({lat:state.place.lat,lon:state.place.lon,name:state.place.name,temp:state.weather.current.temperature_2m,time:Date.now()});applyTheme();}
function applyTheme(){applyPerformance();let t=state.settings.theme;if(t==='auto')t=state.weather?.current?.is_day?'light':'dark';document.body.dataset.theme=t;document.body.classList.toggle('reduce-motion',state.settings.reducedMotion)}
function saveCurrent(){if(!state.place)return;const id=`${state.place.lat.toFixed(3)},${state.place.lon.toFixed(3)}`;upsertPlace({...state.place,id,temp:state.weather?.current?.temperature_2m??null,updatedAt:Date.now()});renderPlaces(state);toast('Place saved')}
function updateRadarControls(){const s=radarState();const time=s.time?new Date(s.time*1000).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'Radar unavailable';$('#radarPlay').textContent=s.playing?'Pause':'Play';$('#radarTime').textContent=time;$('#radarBadgeTime').textContent=time;$('#radarProgress').style.setProperty('--radar-progress',s.total?`${((s.index+1)/s.total)*100}%`:'0%');$('#radarStatus').textContent=s.total?`${s.total} recent frames · past radar only`:'Radar unavailable';const slider=$('#radarSlider');if(slider){slider.max=String(Math.max(0,s.total-1));slider.value=String(Math.max(0,s.index));slider.disabled=!s.total}}

function detectPerformanceTier(){
 const cores=Number(navigator.hardwareConcurrency||4);
 const memory=Number(navigator.deviceMemory||0);
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 if(reduced)return 'low';
 if(memory&&memory<=2)return 'low';
 if(cores<=2)return 'low';
 if(memory&&memory<=4)return 'medium';
 if(cores<=4)return 'medium';
 return 'high';
}
function applyPerformance(){
 const mode=state.settings.performanceMode||'auto';
 const tier=detectPerformanceTier();
 let effective=mode==='auto'?(tier==='low'?'compatibility':tier==='medium'?'balanced':'performance'):mode;
 const autoReduced=mode==='auto'&&(tier==='low'||tier==='medium');
 if(effective==='battery'||effective==='compatibility'||autoReduced){
   document.body.classList.add('perf-reduced');
 }else{
   document.body.classList.toggle('perf-reduced',!!state.settings.reduceEffects);
 }
 document.body.dataset.performance=effective;
 const fps=Number(state.settings.performanceFps||60);
 document.documentElement.style.setProperty('--raincheck-fps',String(Math.max(30,Math.min(60,fps))));
 document.documentElement.style.setProperty('--raincheck-animation-duration',`${Math.max(0,1000/Math.max(30,fps))}ms`);
}
function startPerformanceMonitor(){
 if(!('requestAnimationFrame'in window))return;
 let degraded=false,last=performance.now(),frames=0,lastSample=last;
 const tick=now=>{
   frames++;
   if(now-lastSample>=2500){
     const fps=frames*1000/(now-lastSample);
     const shouldReduce=state.settings.performanceMode==='auto'&&fps<30;
     if(shouldReduce!==degraded){
       degraded=shouldReduce;
       document.body.classList.toggle('perf-auto-degraded',degraded);
     }
     frames=0;lastSample=now;
   }
   requestAnimationFrame(tick);
 };
 requestAnimationFrame(tick);
}
function initLazyRadar(){
 const btn=$('#mobileRadarBtn'), panel=document.querySelector('.map-panel');
 const open=async()=>{
   if(!state.place)return;
   state.mapReady=true;
   panel?.scrollIntoView({behavior:state.settings.reducedMotion?'auto':'smooth',block:'start'});
   try{await initWeatherMap('mapFrame',state.place.lat,state.place.lon);updateRadarControls()}catch(err){console.warn('Map unavailable',err)}
 };
 if(btn)btn.onclick=open;
 // On larger screens, initialize only when the map is close to entering the viewport.
 if(panel&&'IntersectionObserver'in window){
   const observer=new IntersectionObserver(entries=>{
     if(entries.some(e=>e.isIntersecting)){
       observer.disconnect();
       if(state.place){state.mapReady=true;initWeatherMap('mapFrame',state.place.lat,state.place.lon).then(updateRadarControls).catch(()=>{})}
     }
   },{rootMargin:'600px 0px'});
   observer.observe(panel);
 }
}
async function setup(){
 applyPerformance();
 initLazyRadar();
 startPerformanceMonitor();
 setRadarPlaybackRate(state.settings.performanceFps||60);
 const scheduleInput=$('#planDateTime');if(scheduleInput&&!scheduleInput.value){const d=new Date(Date.now()+60*60e3);d.setSeconds(0,0);const pad=n=>String(n).padStart(2,'0');scheduleInput.value=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;scheduleInput.min=`${new Date().getFullYear()}-${pad(new Date().getMonth()+1)}-${pad(new Date().getDate())}T${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`}
 $('#searchBtn').onclick=search;els.city.oninput=e=>{clearTimeout(setup.t);setup.t=setTimeout(async()=>{const q=e.target.value.trim();if(q.length<2){els.suggestions.classList.add('hidden');return}try{renderSuggestions(await searchPlaces(q))}catch{}},220)};els.city.onkeydown=e=>{if(e.key==='Enter')search();if(e.key==='Escape')els.suggestions.classList.add('hidden')};$('#locationBtn').onclick=locate;
 els.suggestions.onclick=e=>{const b=e.target.closest('.suggestion');if(b)choose({name:b.dataset.name,country:b.dataset.country,admin:b.dataset.admin,lat:+b.dataset.lat,lon:+b.dataset.lon})};
 $('#celsiusBtn').onclick=()=>{state.settings=saveSettings({unit:'metric'});render()};$('#fahrenheitBtn').onclick=()=>{state.settings=saveSettings({unit:'imperial'});render()};
 $('#placesBtn').onclick=()=>{renderPlaces(state);openModal('placesModal')};$('#settingsBtn').onclick=()=>openModal('settingsModal');$('#mobilePlacesBtn').onclick=()=>{renderPlaces(state);openModal('placesModal')};$('#mobileSettingsBtn').onclick=()=>openModal('settingsModal');$('#creditsBtn').onclick=()=>openModal('creditsModal');$('#themeBtn').onclick=()=>openModal('themeModal');$('#refreshBtn').onclick=()=>state.place&&loadPlace(state.place,{cache:false});
 $('#shareBtn').onclick=async()=>{if(!state.weather)return;const r=await shareWeather({place:state.place,data:state.weather,unit:state.settings.unit});toast(r==='shared'?'Shared':r==='copied'?'Copied':'Share unavailable')};$('#downloadShareBtn').onclick=()=>state.weather&&downloadShareCard({place:state.place,data:state.weather,unit:state.settings.unit});$('#saveCurrentPlaceBtn').onclick=saveCurrent;$('#saveCurrentPlaceModalBtn').onclick=saveCurrent;$('#clearPlacesBtn').onclick=()=>{clearPlaces();renderPlaces(state);toast('Places cleared')};
 $('#notificationBtn').onclick=async()=>{const p=await enableNotifications();if(p==='granted')state.settings=saveSettings({notifications:true});toast(p==='granted'?'Notifications enabled':p==='unsupported'?'Notifications are unsupported':'Notifications not enabled');render()};
 $('#reducedMotionToggle').onchange=e=>{state.settings=saveSettings({reducedMotion:e.target.checked});applyTheme()};
 $('#performanceMode').onchange=e=>{state.settings=saveSettings({performanceMode:e.target.value});applyPerformance();applyTheme()};
 $('#performanceFps').onchange=e=>{state.settings=saveSettings({performanceFps:Number(e.target.value)});applyPerformance();setRadarPlaybackRate(state.settings.performanceFps)};
 $('#reduceEffectsToggle').onchange=e=>{state.settings=saveSettings({reduceEffects:e.target.checked});applyPerformance()};
 $('#lazyRadarToggle').onchange=e=>{state.settings=saveSettings({pauseRadarWhenHidden:e.target.checked})};
$('#defaultPlaceSelect').onchange=e=>{state.settings=saveSettings({defaultPlaceId:e.target.value});const p=getPlaces().find(x=>x.id===e.target.value);if(p)loadPlace(p)};
 $('#settingsCelsius').onclick=()=>{state.settings=saveSettings({unit:'metric'});render()};$('#settingsFahrenheit').onclick=()=>{state.settings=saveSettings({unit:'imperial'});render()};$('#morningBriefingToggle').onchange=e=>state.settings=saveSettings({morningBriefing:e.target.checked});$('#eveningBriefingToggle').onchange=e=>state.settings=saveSettings({eveningBriefing:e.target.checked});$('#scheduledBriefingToggle').onchange=e=>state.settings=saveSettings({scheduledBriefing:e.target.checked});$('#radarAutoplayToggle').onchange=e=>state.settings=saveSettings({radarAutoplay:e.target.checked});
 ['rainThreshold','heatThreshold','windThreshold'].forEach(id=>$('#'+id).onchange=e=>{const key={rainThreshold:'notificationRainChance',heatThreshold:'notificationHeat',windThreshold:'notificationWind'}[id];state.settings=saveSettings({[key]:Number(e.target.value)})});
 $('#activityMode').onchange=e=>{state.settings=saveSettings({activityMode:e.target.value});render()};
 $$('[data-close]').forEach(x=>x.onclick=()=>closeModal(x.dataset.close));
 $('#placesList').onclick=e=>{const rm=e.target.closest('[data-remove]');if(rm){e.stopPropagation();removePlace(rm.dataset.remove);renderPlaces(state);return}const row=e.target.closest('[data-place]');if(row){const p=getPlaces().find(x=>x.id===row.dataset.place);if(p){closeModal('placesModal');loadPlace(p)}}};
 $('#comparePlacesBtn').onclick=async()=>{const places=getPlaces();const box=$('#placesComparison');if(places.length<2){box.classList.remove('hidden');box.innerHTML='<div class="empty">Save at least two places to compare them.</div>';return}box.classList.remove('hidden');box.innerHTML='<div class="comparison-loading">Comparing saved places…</div>';try{const rows=await Promise.all(places.slice(0,6).map(async p=>{try{const w=await fetchWeather(p.lat,p.lon);return {p,w}}catch{return {p,w:null}}}));box.innerHTML='<div class="comparison-grid">'+rows.map(({p,w})=>w?`<article><strong>${safe(p.name)}</strong><span>${Math.round(w.current.temperature_2m)}°</span><small>${safe(w.current.weather_code!=null?weatherInfoLabel(w.current.weather_code):'Weather')}</small><em>Rain ${w.daily.precipitation_probability_max?.[0]??0}% · Wind ${Math.round(w.current.wind_speed_10m??0)} km/h</em></article>`:`<article><strong>${safe(p.name)}</strong><span>Unavailable</span><small>Could not load weather</small></article>`).join('')+'</div>'}catch{box.innerHTML='<div class="empty">Comparison failed. Try again.</div>'}};
 $$('input[name="theme"]').forEach(r=>r.onchange=e=>{state.settings=saveSettings({theme:e.target.value});applyTheme();closeModal('themeModal')});
 $$('.trend-tab').forEach(b=>b.onclick=()=>{$$('.trend-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.trend-chart').forEach(x=>x.classList.add('hidden'));$('#'+b.dataset.trend+'Trend').classList.remove('hidden')});
 $('#travelCheckBtn').onclick=()=>{const m=Number($('#travelMinutes').value);state.settings=saveSettings({commuteMinutes:m});const r=commuteAdvice(state.weather,m);$('#travelResult').innerHTML=`<strong>${safe(r.title)}</strong><span>${safe(r.text)}</span>`};
 $('#scheduleCheckBtn').onclick=()=>{if(!state.weather)return;const r=planAt(state.weather,$('#planDateTime').value,Number($('#planDuration').value));const box=$('#scheduleResult');box.className=`schedule-result ${r.level||'neutral'}`;const icon=r.level==='good'?'circle-check':r.level==='high'?'cloud-rain':r.level==='medium'?'wind':'calendar-days';box.innerHTML=`<div class="schedule-result-icon"><i class="fas fa-${icon}"></i></div><div><strong>${safe(r.title)}</strong><span>${safe(r.text)}</span></div>`};
 $('#radarPlay').onclick=()=>{radarToggle();updateRadarControls()};$('#radarPrev').onclick=()=>{radarStep(-1);updateRadarControls()};$('#radarNext').onclick=()=>{radarStep(1);updateRadarControls()};$('#radarSlider').oninput=e=>{radarSeek(Number(e.target.value));updateRadarControls()};document.addEventListener('raincheck:radarframe',updateRadarControls);document.addEventListener('raincheck:radarplay',updateRadarControls);document.addEventListener('raincheck:radarUnavailable',updateRadarControls);
 $('#scrollTopBtn').onclick=()=>scrollTo({top:0,behavior:'smooth'});addEventListener('scroll',()=>$('#scrollTopBtn').classList.toggle('hidden',scrollY<500));
 addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.installPrompt=e;$('#installBtn').classList.remove('hidden')});$('#installBtn').onclick=async()=>{if(!state.installPrompt)return;state.installPrompt.prompt();await state.installPrompt.userChoice;state.installPrompt=null;$('#installBtn').classList.add('hidden')};
 window.addEventListener('error',e=>reportRuntimeError(e.error||new Error(e.message)));window.addEventListener('unhandledrejection',e=>reportRuntimeError(e.reason||new Error('Unhandled promise rejection')));
 // Service workers are intentionally disabled on local development. This prevents old PWA caches from masking code changes.
 if(!/localhost|127\.0\.0\.1/.test(location.hostname)&&'serviceWorker'in navigator){navigator.serviceWorker.register('./sw.js?v=10.0.1',{updateViaCache:'none'}).then(r=>r.update()).catch(err=>console.warn('Service worker unavailable',err))}
 else if('serviceWorker'in navigator){navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.map(r=>r.unregister()))).then(()=>('caches'in window ? caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))) : Promise.resolve())).catch(()=>{})}
}
setup().then(async()=>{
 const places=getPlaces();const last=getLastLocation();const preferred=state.settings.defaultPlaceId?places.find(p=>p.id===state.settings.defaultPlaceId):null;const initial=preferred||last||places[0];
 if(initial)await loadPlace(initial);else{els.empty.classList.remove('hidden');setLoading(false)}
});
