import { useEffect, useState } from 'react';
import Layout from '../components/Layout/Layout';
import Card from '../components/UI/Card';
import Input from '../components/UI/Input';
import Button from '../components/UI/Button';
import Modal from '../components/UI/Modal';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const UNITS = ['pcs', 'kg', 'g', 'litre', 'ml', 'box', 'crate', 'dozen'];
const ZONES = ['North Zone', 'South Zone', 'East Zone', 'West Zone', 'Central'];
const emptyForm = { name:'', address:'', city:'', state:'', zone:'', contactName:'', contactPhone:'', linkedOutlets:[], isCentralKitchen:false };
const emptyItem = { name:'', sku:'', quantity:0, unit:'pcs', threshold:10 };

const stockStatus = (item) => {
  if (item.quantity === 0) return { label:'Out of Stock', dot:'bg-red-500', text:'text-red-600 dark:text-red-400', bar:'bg-red-500' };
  if (item.quantity <= item.threshold) return { label:'Low Stock', dot:'bg-yellow-400', text:'text-yellow-600 dark:text-yellow-400', bar:'bg-yellow-400' };
  return { label:'In Stock', dot:'bg-green-500', text:'text-green-600 dark:text-green-400', bar:'bg-green-500' };
};
const stockPct = (item) => item.threshold > 0 ? Math.min(100, Math.round((item.quantity/(item.threshold*3))*100)) : 100;
const timeAgo = (d) => {
  const s = Math.floor((Date.now()-new Date(d))/1000);
  if (s<60) return 'just now';
  if (s<3600) return `${Math.floor(s/60)}m ago`;
  if (s<86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
};

const WarehouseManagement = () => {
  const { user } = useAuth();
  const isAdmin = ['Admin','Company Admin'].includes(user?.role);
  const isVendor = user?.role === 'Vendor';

  const [warehouses, setWarehouses] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(null);
  const [tab, setTab] = useState('inventory');
  const [invSearch, setInvSearch] = useState('');

  const [warehouseModal, setWarehouseModal] = useState({ open:false, data:null });
  const [invModal, setInvModal] = useState({ open:false, wh:null });
  const [adjustModal, setAdjustModal] = useState({ open:false, whId:null, item:null });
  const [deleteModal, setDeleteModal] = useState({ open:false, wh:null });
  const [kitchenModal, setKitchenModal] = useState({ open:false, wh:null });
  const [syncModal, setSyncModal] = useState({ open:false, whId:null });

  const [form, setForm] = useState(emptyForm);
  const [invItems, setInvItems] = useState([]);
  const [adjForm, setAdjForm] = useState({ operation:'add', quantity:1 });
  const [kitchenId, setKitchenId] = useState('');
  const [syncNote, setSyncNote] = useState('');

  useEffect(()=>{ fetchAll(); },[]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [wRes, oRes] = await Promise.all([api.get('/warehouse'), api.get('/outlets')]);
      setWarehouses(wRes.data||[]);
      setOutlets(oRes.data||[]);
      if (isAdmin) {
        try { const aRes = await api.get('/warehouse/alerts/low-stock'); setAlerts(aRes.data||[]); } catch(_){}
      }
    } catch(e){ setError(e.response?.data?.message||'Failed to load'); }
    finally { setLoading(false); }
  };

  const refresh = (updated) => {
    setWarehouses(p=>p.map(w=>w._id===updated._id?updated:w));
    if (active?._id===updated._id) setActive(updated);
  };

  const refreshAlerts = async () => {
    if (!isAdmin) return;
    try { const r = await api.get('/warehouse/alerts/low-stock'); setAlerts(r.data||[]); } catch(_){}
  };

  // Warehouse CRUD
  const openCreate = () => { setForm(emptyForm); setWarehouseModal({open:true,data:null}); };
  const openEdit = (w) => {
    setForm({ name:w.name||'', address:w.address||'', city:w.city||'', state:w.state||'', zone:w.zone||'', contactName:w.contactName||'', contactPhone:w.contactPhone||'', isCentralKitchen:w.isCentralKitchen||false, linkedOutlets:w.linkedOutlets?.map(o=>o._id||o)||[] });
    setWarehouseModal({open:true,data:w});
  };
  const saveWarehouse = async () => {
    if (!form.name||!form.address||!form.city||!form.state||!form.zone){ setError('Fill all required fields'); return; }
    setSaving(true);
    try {
      if (warehouseModal.data) { const r=await api.put(`/warehouse/${warehouseModal.data._id}`,form); refresh(r.data); }
      else { const r=await api.post('/warehouse',form); setWarehouses(p=>[r.data,...p]); }
      setWarehouseModal({open:false,data:null}); setError('');
    } catch(e){ setError(e.response?.data?.message||'Save failed'); }
    finally{ setSaving(false); }
  };
  const deleteWarehouse = async () => {
    try {
      await api.delete(`/warehouse/${deleteModal.wh._id}`);
      setWarehouses(p=>p.filter(w=>w._id!==deleteModal.wh._id));
      if (active?._id===deleteModal.wh._id) setActive(null);
      setDeleteModal({open:false,wh:null});
    } catch(e){ setError(e.response?.data?.message||'Delete failed'); }
  };

  // Kitchen
  const toggleKitchen = async (w) => {
    try{ const r=await api.patch(`/warehouse/${w._id}/toggle-kitchen`); refresh(r.data); }catch(e){ setError(e.response?.data?.message||'Failed'); }
  };
  const openKitchen = (w) => { setKitchenId(w.linkedKitchen?._id||w.linkedKitchen||''); setKitchenModal({open:true,wh:w}); };
  const saveKitchen = async () => {
    try{ const r=await api.patch(`/warehouse/${kitchenModal.wh._id}/link-kitchen`,{kitchenId:kitchenId||null}); refresh(r.data); setKitchenModal({open:false,wh:null}); }
    catch(e){ setError(e.response?.data?.message||'Failed'); }
  };

  // Inventory
  const openInv = (w) => {
    setInvItems(w.inventoryItems?.length?w.inventoryItems.map(i=>({...i})):[{...emptyItem}]);
    setInvModal({open:true,wh:w});
  };
  const saveInv = async () => {
    const valid=invItems.filter(i=>i.name.trim());
    setSaving(true);
    try{ const r=await api.put(`/warehouse/${invModal.wh._id}/inventory`,{inventoryItems:valid}); refresh(r.data); setInvModal({open:false,wh:null}); await refreshAlerts(); }
    catch(e){ setError(e.response?.data?.message||'Save failed'); }
    finally{ setSaving(false); }
  };

  // Adjust
  const openAdj = (whId,item) => { setAdjForm({operation:'add',quantity:1}); setAdjustModal({open:true,whId,item}); };
  const adjustStock = async () => {
    setSaving(true);
    try{ const r=await api.patch(`/warehouse/${adjustModal.whId}/inventory/${adjustModal.item._id}/adjust`,adjForm); refresh(r.data); setAdjustModal({open:false,whId:null,item:null}); await refreshAlerts(); }
    catch(e){ setError(e.response?.data?.message||'Failed'); }
    finally{ setSaving(false); }
  };

  // Sync
  const doSync = async (whId) => {
    setSyncing(true);
    try{ const r=await api.post(`/warehouse/${whId}/sync`,{note:syncNote||null}); refresh(r.data); setSyncModal({open:false,whId:null}); setSyncNote(''); await refreshAlerts(); }
    catch(e){ setError(e.response?.data?.message||'Sync failed'); }
    finally{ setSyncing(false); }
  };

  const display = active ? (warehouses.find(w=>w._id===active._id)||active) : null;
  const kitchenOpts = warehouses.filter(w=>w.isCentralKitchen && w._id!==kitchenModal.wh?._id);
  const filtInv = (display?.inventoryItems||[]).filter(i=>!invSearch||i.name.toLowerCase().includes(invSearch.toLowerCase())||(i.sku||'').toLowerCase().includes(invSearch.toLowerCase()));
  const totalItems = display?.inventoryItems?.length||0;
  const lowItems = display?.inventoryItems?.filter(i=>i.quantity<=i.threshold).length||0;
  const outItems = display?.inventoryItems?.filter(i=>i.quantity===0).length||0;

  if (loading) return (
    <Layout headerProps={{title:'Warehouse Management'}}>
      <div className="flex items-center justify-center h-full"><div className="text-center"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"/><p className="mt-4 text-slate-600 dark:text-slate-400">Loading...</p></div></div>
    </Layout>
  );

  return (
    <Layout headerProps={{ title:'Warehouse Management', actionButton: isAdmin ? <Button onClick={openCreate}><span className="material-icons-outlined text-sm">add</span>New Warehouse</Button> : null }}>
      <div className="p-6 space-y-5">

        {error && (
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
            <span className="material-icons-outlined text-sm">error</span>
            <span className="flex-1">{error}</span>
            <button onClick={()=>setError('')}><span className="material-icons-outlined text-sm">close</span></button>
          </div>
        )}

        {/* Low-stock alert strip */}
        {isAdmin && alerts.length>0 && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center">
                <span className="material-icons-outlined text-yellow-600 dark:text-yellow-400 text-sm">warning</span>
              </div>
              <p className="font-semibold text-yellow-800 dark:text-yellow-300 text-sm">{alerts.length} Low-Stock Alert{alerts.length>1?'s':''}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {alerts.slice(0,8).map(a=>(
                <div key={`${a.warehouseId}-${a.itemId}`} className="flex items-center gap-2 bg-white dark:bg-slate-900/60 rounded-lg px-3 py-1.5 text-xs border border-yellow-100 dark:border-yellow-900">
                  <span className={`w-1.5 h-1.5 rounded-full ${a.quantity===0?'bg-red-500':'bg-yellow-400'}`}/>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{a.itemName}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-500">{a.warehouseName}</span>
                  <span className={`font-bold ml-1 ${a.quantity===0?'text-red-500':'text-yellow-600'}`}>{a.quantity} {a.unit}</span>
                </div>
              ))}
              {alerts.length>8 && <span className="text-xs text-slate-400 px-3 py-1.5 bg-white dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-800">+{alerts.length-8} more</span>}
            </div>
          </div>
        )}

        {/* Main layout */}
        <div className="flex gap-5 min-h-[600px]">

          {/* Sidebar */}
          <div className="w-68 flex-shrink-0 space-y-2" style={{width:'17rem'}}>
            {warehouses.length===0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="material-icons-outlined text-5xl text-slate-200 dark:text-slate-700 block mb-3">warehouse</span>
                <p className="text-sm text-slate-400 mb-4">No warehouses yet</p>
                {isAdmin && <Button onClick={openCreate} className="text-sm">Add First</Button>}
              </div>
            ) : warehouses.map(w=>{
              const wLow=w.inventoryItems?.filter(i=>i.quantity<=i.threshold).length||0;
              const isAct=active?._id===w._id;
              return (
                <button key={w._id} onClick={()=>{setActive(w);setTab('inventory');setInvSearch('');}}
                  className={`w-full text-left rounded-2xl border p-4 transition-all ${isAct?'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm':'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/40 hover:shadow-sm'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {w.isCentralKitchen && <span className="material-icons-outlined text-[13px] text-orange-500">soup_kitchen</span>}
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-white truncate">{w.name}</h3>
                      </div>
                      <p className="text-xs text-slate-400 truncate">{w.city} · {w.zone}</p>
                    </div>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${w.isActive?'bg-green-400':'bg-slate-300'}`}/>
                  </div>
                  <div className="flex items-center gap-3 mt-2.5">
                    <span className="text-xs text-slate-500">{w.inventoryItems?.length||0} items</span>
                    {wLow>0 && <span className="flex items-center gap-0.5 text-xs text-yellow-600 dark:text-yellow-400 font-medium"><span className="material-icons-outlined text-[12px]">warning</span>{wLow}</span>}
                    {w.linkedKitchen && <span className="flex items-center gap-0.5 text-xs text-blue-500"><span className="material-icons-outlined text-[12px]">link</span>Kitchen</span>}
                    {w.isCentralKitchen && <span className="text-xs text-orange-500 font-medium">CK</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail panel */}
          {!display ? (
            <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="text-center">
                <span className="material-icons-outlined text-6xl text-slate-200 dark:text-slate-700 block mb-3">inventory_2</span>
                <p className="text-sm text-slate-400">Select a warehouse to view details</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-0 space-y-4">

              {/* Header card */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      {display.isCentralKitchen && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-semibold rounded-full">
                          <span className="material-icons-outlined text-[12px]">soup_kitchen</span>Central Kitchen
                        </span>
                      )}
                      {display.linkedKitchen && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-semibold rounded-full">
                          <span className="material-icons-outlined text-[12px]">link</span>→ {display.linkedKitchen.name||'Kitchen'}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{display.name}</h2>
                    <p className="text-sm text-slate-500 mt-0.5">{display.address}, {display.city}, {display.state}</p>
                    {display.contactName && (
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <span className="material-icons-outlined text-[13px]">person</span>
                        {display.contactName}{display.contactPhone&&` · ${display.contactPhone}`}
                      </p>
                    )}
                    {display.linkedOutlets?.length>0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {display.linkedOutlets.map(o=>(
                          <span key={o._id||o} className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full">{o.name||'Outlet'}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(isVendor||isAdmin) && (
                      <Button variant="outline" onClick={()=>setSyncModal({open:true,whId:display._id})} disabled={!display.linkedKitchen}>
                        <span className="material-icons-outlined text-sm">sync</span>Sync Kitchen
                      </Button>
                    )}
                    {isAdmin && (
                      <>
                        <Button variant="outline" onClick={()=>openKitchen(display)}>
                          <span className="material-icons-outlined text-sm">link</span>Kitchen Config
                        </Button>
                        <Button variant="secondary" onClick={()=>openEdit(display)}>
                          <span className="material-icons-outlined text-sm">edit</span>Edit
                        </Button>
                        <Button variant="danger" onClick={()=>setDeleteModal({open:true,wh:display})}>
                          <span className="material-icons-outlined text-sm">delete</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {/* KPI strip */}
                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  {[{label:'Total Items',val:totalItems,color:'text-slate-900 dark:text-white'},{label:'Low Stock',val:lowItems,color:'text-yellow-600'},{label:'Out of Stock',val:outItems,color:'text-red-500'}].map(k=>(
                    <div key={k.label} className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      <p className={`text-2xl font-bold ${k.color}`}>{k.val}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{k.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                {['inventory','sync','info'].map(t=>(
                  <button key={t} onClick={()=>setTab(t)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${tab===t?'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white':'text-slate-500 dark:text-slate-400'}`}>
                    {t==='sync'?'Sync Log':t}
                  </button>
                ))}
              </div>

              {/* Tab: Inventory */}
              {tab==='inventory' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 gap-3 flex-wrap">
                    <div className="relative">
                      <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                      <input className="pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 w-52" placeholder="Search items..." value={invSearch} onChange={e=>setInvSearch(e.target.value)}/>
                    </div>
                    <Button onClick={()=>openInv(display)}>
                      <span className="material-icons-outlined text-sm">edit</span>Manage Items
                    </Button>
                  </div>
                  {filtInv.length===0 ? (
                    <div className="text-center py-12">
                      <span className="material-icons-outlined text-5xl text-slate-200 dark:text-slate-700 block mb-2">inventory</span>
                      <p className="text-sm text-slate-400">{invSearch?'No items match':'No inventory yet — click Manage Items to add stock'}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50 dark:divide-slate-800">
                      {filtInv.map(item=>{
                        const st=stockStatus(item); const pct=stockPct(item);
                        return (
                          <div key={item._id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                              <span className="material-icons-outlined text-slate-400 text-sm">inventory_2</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-slate-900 dark:text-white truncate">{item.name}</span>
                                {item.sku && <span className="text-xs text-slate-400 font-mono">{item.sku}</span>}
                              </div>
                              <div className="flex items-center gap-3 mt-1.5">
                                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden max-w-[120px]">
                                  <div className={`h-full rounded-full transition-all ${st.bar}`} style={{width:`${pct}%`}}/>
                                </div>
                                <span className="text-xs text-slate-400">{item.quantity}/{item.threshold*3} {item.unit}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className={`flex items-center gap-1 text-xs font-medium ${st.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}/>{st.label}
                              </span>
                              <span className="text-sm font-bold text-slate-900 dark:text-white w-18 text-right">{item.quantity} {item.unit}</span>
                              <button onClick={()=>openAdj(display._id,item)} className="p-1.5 rounded-lg hover:bg-primary/10 text-slate-400 hover:text-primary transition-colors" title="Adjust">
                                <span className="material-icons-outlined text-sm">tune</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Sync Log */}
              {tab==='sync' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="font-semibold text-sm">Kitchen Sync History</h3>
                    <Button onClick={()=>setSyncModal({open:true,whId:display._id})}>
                      <span className="material-icons-outlined text-sm">sync</span>Sync Now
                    </Button>
                  </div>
                  {!display.syncLog?.length ? (
                    <div className="text-center py-12 text-slate-400 text-sm">No syncs recorded yet</div>
                  ) : (
                    <div className="divide-y divide-slate-50 dark:divide-slate-800">
                      {[...display.syncLog].reverse().slice(0,20).map((log,i)=>(
                        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                            <span className="material-icons-outlined text-green-600 dark:text-green-400 text-sm">sync</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                              {log.itemsSynced} items synced
                              {log.itemsAdded>0 && <span className="text-green-600 dark:text-green-400 ml-1">(+{log.itemsAdded} new)</span>}
                              {log.itemsUpdated>0 && <span className="text-blue-600 dark:text-blue-400 ml-1">({log.itemsUpdated} updated)</span>}
                              {log.note && <span className="font-normal text-slate-500 ml-2">— {log.note}</span>}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {log.syncedBy?.name||'System'}{log.syncedBy?.role&&` · ${log.syncedBy.role}`}
                              {log.sourceKitchenName && <span className="ml-2">← {log.sourceKitchenName}</span>}
                            </p>
                          </div>
                          <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(log.syncedAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Info */}
              {tab==='info' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[['Zone',display.zone,'location_on'],['City',display.city,'apartment'],['State',display.state,'map'],['Status',display.isActive?'Active':'Inactive','circle'],['Central Kitchen',display.isCentralKitchen?'Yes':'No','soup_kitchen'],['Linked Kitchen',display.linkedKitchen?.name||'None','link']].map(([label,val,icon])=>(
                      <div key={label} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <span className="material-icons-outlined text-slate-400 text-sm">{icon}</span>
                        <div><p className="text-xs text-slate-400">{label}</p><p className="text-sm font-medium text-slate-900 dark:text-white">{val||'—'}</p></div>
                      </div>
                    ))}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 rounded-xl">
                      <div className="flex items-center gap-2">
                        <span className="material-icons-outlined text-orange-500">soup_kitchen</span>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">Central Kitchen</p>
                          <p className="text-xs text-slate-400">Other warehouses can link here for sync</p>
                        </div>
                      </div>
                      <button onClick={()=>toggleKitchen(display)} className={`relative inline-flex h-6 w-11 rounded-full border-2 border-transparent transition-colors ${display.isCentralKitchen?'bg-orange-500':'bg-slate-300 dark:bg-slate-600'}`}>
                        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${display.isCentralKitchen?'translate-x-5':'translate-x-0'}`}/>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Warehouse Modal */}
      <Modal isOpen={warehouseModal.open} onClose={()=>setWarehouseModal({open:false,data:null})} title={warehouseModal.data?'Edit Warehouse':'Add Warehouse'} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Name *" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Central Warehouse"/>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Zone *</label>
              <select className="w-full border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent px-4 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary/20" value={form.zone} onChange={e=>setForm({...form,zone:e.target.value})}>
                <option value="">Select zone</option>
                {ZONES.map(z=><option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <Input label="City *" value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/>
            <Input label="State *" value={form.state} onChange={e=>setForm({...form,state:e.target.value})}/>
            <Input label="Contact Name" value={form.contactName} onChange={e=>setForm({...form,contactName:e.target.value})}/>
            <Input label="Contact Phone" value={form.contactPhone} onChange={e=>setForm({...form,contactPhone:e.target.value})}/>
          </div>
          <Input label="Address *" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="Street address"/>
          <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-900/30">
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined text-orange-500 text-sm">soup_kitchen</span>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Mark as Central Kitchen</span>
            </div>
            <button type="button" onClick={()=>setForm({...form,isCentralKitchen:!form.isCentralKitchen})} className={`relative inline-flex h-6 w-11 rounded-full border-2 border-transparent transition-colors ${form.isCentralKitchen?'bg-orange-500':'bg-slate-300 dark:bg-slate-600'}`}>
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${form.isCentralKitchen?'translate-x-5':'translate-x-0'}`}/>
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Linked Outlets</label>
            <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
              {outlets.map(o=>(
                <label key={o._id} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input type="checkbox" className="rounded accent-primary" checked={form.linkedOutlets.includes(o._id)} onChange={e=>setForm({...form,linkedOutlets:e.target.checked?[...form.linkedOutlets,o._id]:form.linkedOutlets.filter(id=>id!==o._id)})}/>
                  <span className="truncate">{o.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={()=>setWarehouseModal({open:false,data:null})} disabled={saving}>Cancel</Button>
            <Button className="flex-1" onClick={saveWarehouse} disabled={saving}>{saving?'Saving...':warehouseModal.data?'Save Changes':'Create'}</Button>
          </div>
        </div>
      </Modal>

      {/* Kitchen Config Modal */}
      <Modal isOpen={kitchenModal.open} onClose={()=>setKitchenModal({open:false,wh:null})} title="Kitchen Configuration" size="sm">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
            <div><p className="text-sm font-medium text-slate-800 dark:text-slate-200">Mark as Central Kitchen</p><p className="text-xs text-slate-400 mt-0.5">Other warehouses can sync here</p></div>
            <button onClick={()=>toggleKitchen(kitchenModal.wh)} className={`relative inline-flex h-6 w-11 rounded-full border-2 border-transparent transition-colors ${kitchenModal.wh?.isCentralKitchen?'bg-orange-500':'bg-slate-300 dark:bg-slate-600'}`}>
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${kitchenModal.wh?.isCentralKitchen?'translate-x-5':'translate-x-0'}`}/>
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Link to Central Kitchen</label>
            <select className="w-full border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent px-4 py-2 text-slate-900 dark:text-slate-100" value={kitchenId} onChange={e=>setKitchenId(e.target.value)}>
              <option value="">None</option>
              {kitchenOpts.map(k=><option key={k._id} value={k._id}>{k.name} — {k.city}</option>)}
            </select>
            {kitchenOpts.length===0 && <p className="text-xs text-slate-400 mt-1.5">No central kitchens available. Mark a warehouse as Central Kitchen first.</p>}
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={()=>setKitchenModal({open:false,wh:null})}>Cancel</Button>
            <Button className="flex-1" onClick={saveKitchen}>Save Config</Button>
          </div>
        </div>
      </Modal>

      {/* Inventory Modal */}
      <Modal isOpen={invModal.open} onClose={()=>setInvModal({open:false,wh:null})} title={`Manage Inventory — ${invModal.wh?.name}`} size="lg">
        <div className="space-y-3">
          <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
            <span className="col-span-3">Name *</span><span className="col-span-2">SKU</span><span className="col-span-2">Qty</span><span className="col-span-2">Unit</span><span className="col-span-2">Threshold</span><span className="col-span-1"/>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {invItems.map((item,idx)=>(
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2">
                <input className="col-span-3 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20" placeholder="Item name" value={item.name} onChange={e=>{const u=[...invItems];u[idx]={...u[idx],name:e.target.value};setInvItems(u);}}/>
                <input className="col-span-2 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20" placeholder="SKU" value={item.sku||''} onChange={e=>{const u=[...invItems];u[idx]={...u[idx],sku:e.target.value};setInvItems(u);}}/>
                <input type="number" className="col-span-2 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20" min={0} value={item.quantity} onChange={e=>{const u=[...invItems];u[idx]={...u[idx],quantity:Number(e.target.value)};setInvItems(u);}}/>
                <select className="col-span-2 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-sm bg-white dark:bg-slate-800" value={item.unit} onChange={e=>{const u=[...invItems];u[idx]={...u[idx],unit:e.target.value};setInvItems(u);}}>
                  {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                </select>
                <input type="number" className="col-span-2 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary/20" min={0} value={item.threshold} onChange={e=>{const u=[...invItems];u[idx]={...u[idx],threshold:Number(e.target.value)};setInvItems(u);}}/>
                <button onClick={()=>setInvItems(p=>p.filter((_,i)=>i!==idx))} className="col-span-1 flex justify-center text-red-400 hover:text-red-600">
                  <span className="material-icons-outlined text-sm">delete</span>
                </button>
              </div>
            ))}
          </div>
          <button onClick={()=>setInvItems(p=>[...p,{...emptyItem}])} className="text-sm text-primary hover:underline flex items-center gap-1">
            <span className="material-icons-outlined text-sm">add</span>Add Item
          </button>
          <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" className="flex-1" onClick={()=>setInvModal({open:false,wh:null})} disabled={saving}>Cancel</Button>
            <Button className="flex-1" onClick={saveInv} disabled={saving}>{saving?'Saving...':'Save Inventory'}</Button>
          </div>
        </div>
      </Modal>

      {/* Adjust Modal */}
      <Modal isOpen={adjustModal.open} onClose={()=>setAdjustModal({open:false,whId:null,item:null})} title={`Adjust — ${adjustModal.item?.name}`} size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <span className="material-icons-outlined text-slate-400">inventory_2</span>
            <div><p className="text-xs text-slate-400">Current stock</p><p className="font-bold text-slate-900 dark:text-white">{adjustModal.item?.quantity} {adjustModal.item?.unit}</p></div>
          </div>
          <div className="flex gap-3">
            {['add','subtract'].map(op=>(
              <button key={op} onClick={()=>setAdjForm({...adjForm,operation:op})}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${adjForm.operation===op?(op==='add'?'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400':'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'):'border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                <span className="material-icons-outlined text-sm">{op==='add'?'add_circle':'remove_circle'}</span>
                {op==='add'?'Add':'Remove'}
              </button>
            ))}
          </div>
          <Input label="Quantity" type="number" value={adjForm.quantity} onChange={e=>setAdjForm({...adjForm,quantity:Number(e.target.value)})} min={1}/>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={()=>setAdjustModal({open:false,whId:null,item:null})} disabled={saving}>Cancel</Button>
            <Button className={`flex-1 ${adjForm.operation==='subtract'?'!bg-red-600 hover:!bg-red-700':''}`} onClick={adjustStock} disabled={saving}>
              {saving?'Updating...':`${adjForm.operation==='add'?'+':'-'}${adjForm.quantity} ${adjustModal.item?.unit||''}`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Sync Modal */}
      <Modal isOpen={syncModal.open} onClose={()=>{setSyncModal({open:false,whId:null});setSyncNote('');}} title="Sync from Central Kitchen" size="sm">
        <div className="space-y-4">
          {display?.linkedKitchen ? (
            <>
              <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-sm text-blue-700 dark:text-blue-400">
                <span className="material-icons-outlined text-lg flex-shrink-0">sync</span>
                <div>
                  <p className="font-medium">Pull inventory from: {display.linkedKitchen.name||'Central Kitchen'}</p>
                  <p className="mt-1 text-xs opacity-80">This will update existing items and add any new items from the central kitchen into this warehouse's inventory.</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Note (optional)</label>
                <textarea className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm dark:bg-slate-800 bg-white outline-none focus:ring-2 focus:ring-primary/20 resize-none" rows={3} placeholder="e.g. Weekly restock sync..." value={syncNote} onChange={e=>setSyncNote(e.target.value)}/>
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={()=>{setSyncModal({open:false,whId:null});setSyncNote('');}} disabled={syncing}>Cancel</Button>
                <Button className="flex-1" onClick={()=>doSync(syncModal.whId)} disabled={syncing}>{syncing?'Syncing...':'Sync Now'}</Button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <span className="material-icons-outlined text-4xl text-slate-300 dark:text-slate-600 block mb-2">link_off</span>
              <p className="text-sm text-slate-500 dark:text-slate-400">No central kitchen linked to this warehouse.</p>
              <p className="text-xs text-slate-400 mt-1">Go to Kitchen Config to link one first.</p>
              <Button variant="secondary" className="mt-4" onClick={()=>{setSyncModal({open:false,whId:null});setSyncNote('');}}>Close</Button>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={deleteModal.open} onClose={()=>setDeleteModal({open:false,wh:null})} title="Delete Warehouse" size="sm">
        <div className="space-y-4">
          <p className="text-slate-600 dark:text-slate-400 text-sm">Delete <span className="font-bold">{deleteModal.wh?.name}</span>? This permanently removes all inventory records and cannot be undone.</p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={()=>setDeleteModal({open:false,wh:null})}>Cancel</Button>
            <Button variant="danger" className="flex-1" onClick={deleteWarehouse}>Delete</Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
};

export default WarehouseManagement;
