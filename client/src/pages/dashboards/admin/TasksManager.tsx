import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../../app/AuthContext";
import { useApi } from "../../../hooks/useApi";
import { apiFetch } from "../../../lib/api";
import { fmtDate } from "../../../lib/dateFormat";
import { ar, TASK_DEPT_CONFIG } from "./shared";
import type { TaskUiDepartment, TaskStaffMember } from "./shared";

export function TasksManager() {
  const { getAuthHeader } = useAuth();
  const { data, refetch } = useApi<{ items: any[] }>("/tasks/admin");
  const [showCreate, setShowCreate] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [deptStaff, setDeptStaff] = useState<TaskStaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  const [form, setForm] = useState({ 
    title: "", 
    description: "", 
    priority: "yellow", 
    assignedDepartment: "CS" as TaskUiDepartment,
    assignedPeople: [] as string[],
    dueDate: new Date(Date.now() + 86400000).toISOString() 
  });

  useEffect(() => {
    const dept = TASK_DEPT_CONFIG[form.assignedDepartment];
    if (!dept) {
      setDeptStaff([]);
      return;
    }
    let cancelled = false;
    setLoadingStaff(true);
    apiFetch<{ items: Array<{ id: string; fullName?: string; username?: string; phone?: string; isActive?: boolean }> }>(
      `/users/admin?role=${dept.role}`,
      { headers: getAuthHeader() }
    )
      .then((res) => {
        if (cancelled) return;
        const items = (res.items || [])
          .filter((u) => u.isActive !== false)
          .map((u) => ({
            id: u.id,
            name: u.fullName || u.username || u.phone || "—",
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setDeptStaff(items);
      })
      .catch(() => {
        if (!cancelled) setDeptStaff([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingStaff(false);
      });
    return () => { cancelled = true; };
  }, [form.assignedDepartment, getAuthHeader]);

  const staffNameById = useMemo(
    () => Object.fromEntries(deptStaff.map((s) => [s.id, s.name])),
    [deptStaff]
  );

  const togglePerson = (personId: string) => {
    setForm(prev => {
      const current = prev.assignedPeople;
      if (current.includes(personId)) return { ...prev, assignedPeople: current.filter(p => p !== personId) };
      return { ...prev, assignedPeople: [...current, personId] };
    });
  };

  const createTask = async () => {
    const dept = TASK_DEPT_CONFIG[form.assignedDepartment];
    const selectedNames = form.assignedPeople.map((id) => staffNameById[id]).filter(Boolean);
    let description = form.description.trim();
    if (selectedNames.length > 0) {
      const assigneeLine = ar()
        ? `المكلفون: ${selectedNames.join("، ")}`
        : `Assignees: ${selectedNames.join(", ")}`;
      description = description ? `${description}\n\n${assigneeLine}` : assigneeLine;
    }

    await apiFetch("/tasks/admin", {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({
        title: form.title,
        description: description || "—",
        priority: form.priority,
        assignedDepartments: [dept.taskDept],
        dueDate: form.dueDate,
      }),
    });
    setShowCreate(false);
    setForm({ title: "", description: "", priority: "yellow", assignedDepartment: "CS", assignedPeople: [], dueDate: new Date(Date.now() + 86400000).toISOString() });
    refetch();
  };

  const priorityColors: Record<string, string> = { red: "priority-red", yellow: "priority-yellow", green: "priority-green" };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "إدارة المهام والتكليفات" : "Task Management & Assignments"}</h3>
        <button className="btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>+ {ar() ? "مهمة جديدة" : "New Task"}</button>
      </div>
      
      {showCreate && (
        <div className="card-elevated p-6 animate-slide-up bg-surface-50/50 border border-surface-200 mb-6">
          <h4 className="font-bold text-surface-900 mb-5">{ar() ? "تفاصيل المهمة" : "Task Details"}</h4>
          <div className="grid gap-5 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "عنوان المهمة" : "Task Title"}</label>
              <input className="input-field" placeholder={ar() ? "مثال: مراجعة العيادة الجديدة" : "e.g. Review new clinic application"} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "الأولوية" : "Priority"}</label>
              <select className="select-field" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                <option value="red">🔴 High / عالي</option>
                <option value="yellow">🟡 Medium / متوسط</option>
                <option value="green">🟢 Low / منخفض</option>
              </select>
            </div>
            
            <div className="md:col-span-3 border-t border-surface-200 mt-2 pt-5">
              <h5 className="font-bold text-sm text-surface-800 mb-4">{ar() ? "تعيين المهمة (Assignment)" : "Task Assignment"}</h5>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "القسم الموجه له" : "Target Department"}</label>
                  <select className="select-field" value={form.assignedDepartment} onChange={e => setForm({ ...form, assignedDepartment: e.target.value as TaskUiDepartment, assignedPeople: [] })}>
                    {(Object.entries(TASK_DEPT_CONFIG) as [TaskUiDepartment, typeof TASK_DEPT_CONFIG[TaskUiDepartment]][]).map(([key, cfg]) => (
                      <option key={key} value={key}>{ar() ? cfg.labelAr : cfg.labelEn}</option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "الموظف المختص (متعدد - اختياري)" : "Specific Person(s) (Optional)"}</label>
                  <div 
                    className="input-field flex items-center justify-between cursor-pointer min-h-[42px] bg-white"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {form.assignedPeople.length === 0 ? (
                        <span className="text-surface-400 text-sm px-1">{ar() ? "الكل في القسم" : "All in Department"}</span>
                      ) : (
                        form.assignedPeople.map(personId => (
                          <span key={personId} className="bg-brand-pink-50 text-brand-pink-700 px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 border border-brand-pink-100 shadow-sm">
                            {staffNameById[personId] || personId}
                            <button 
                              onClick={(e) => { e.stopPropagation(); togglePerson(personId); }}
                              className="hover:text-brand-pink-900 focus:outline-none w-3.5 h-3.5 bg-brand-pink-200/50 rounded-full flex items-center justify-center transition-colors"
                            >×</button>
                          </span>
                        ))
                      )}
                    </div>
                    <svg className={`w-4 h-4 text-surface-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                  
                  {isDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-0" onClick={() => setIsDropdownOpen(false)} />
                      <div className="absolute z-10 w-full mt-1 bg-white border border-surface-200 rounded-xl shadow-xl max-h-48 overflow-y-auto animate-fade-in py-1">
                        {loadingStaff ? (
                          <div className="px-4 py-3 text-sm text-surface-500 text-center">{ar() ? "جاري التحميل..." : "Loading..."}</div>
                        ) : deptStaff.length === 0 ? (
                           <div className="px-4 py-3 text-sm text-surface-500 text-center">{ar() ? "لا يوجد موظفين" : "No employees found"}</div>
                        ) : (
                          deptStaff.map(person => (
                            <label
                              key={person.id}
                              className="flex items-center px-4 py-2.5 hover:bg-surface-50 cursor-pointer transition-colors border-b border-surface-50 last:border-0 group"
                              onClick={(e) => { e.preventDefault(); togglePerson(person.id); }}
                            >
                              <div className={`w-4 h-4 rounded flex items-center justify-center mr-3 transition-colors ${form.assignedPeople.includes(person.id) ? "bg-brand-pink-500 border-brand-pink-500" : "bg-white border border-surface-300 group-hover:border-brand-pink-300"}`}>
                                {form.assignedPeople.includes(person.id) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                              </div>
                              <div className="flex items-center gap-2.5">
                                <div className="w-6 h-6 rounded-full bg-surface-100 flex items-center justify-center text-[10px] font-bold text-surface-600 uppercase border border-surface-200 shadow-sm">{person.name.charAt(0)}</div>
                                <span className="text-sm font-medium text-surface-700">{person.name}</span>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="md:col-span-3 mt-2">
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "الوصف أو الملاحظات" : "Description / Notes"}</label>
              <textarea className="input-field min-h-[80px] resize-y" placeholder={ar() ? "تفاصيل إضافية حول المطلوب..." : "Additional details about the task..."} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            
            <div className="md:col-span-3 flex gap-3 mt-4">
              <button className="btn-primary" onClick={createTask} disabled={!form.title}>{ar() ? "إنشاء وتعيين المهمة" : "Create & Assign Task"}</button>
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>{ar() ? "إلغاء" : "Cancel"}</button>
            </div>
          </div>
        </div>
      )}

      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th></th><th>{ar() ? "العنوان" : "Title"}</th><th>{ar() ? "الجهة المكلفة" : "Assigned To"}</th><th>{ar() ? "الحالة" : "Status"}</th><th>{ar() ? "الموعد" : "Due"}</th></tr></thead>
            <tbody>
              {(data?.items || []).map((t: any) => (
                <tr key={t.id} className="hover:bg-surface-50 transition-colors">
                  <td className="w-8"><div className={priorityColors[t.priority] || "priority-green"} /></td>
                  <td className="font-bold text-surface-800">{t.title}</td>
                  <td>
                     <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-100 text-surface-700 text-xs font-medium">
                       <svg className="w-3.5 h-3.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                       {(t.assignedDepartments || []).join(", ").toUpperCase()}
                     </div>
                  </td>
                  <td><span className={t.status === "completed" ? "badge-green" : t.status === "in_progress" ? "badge-yellow" : "badge-gray"}>{t.status}</span></td>
                  <td className="text-xs text-surface-500 font-medium">{fmtDate(t.dueDate)}</td>
                </tr>
              ))}
              {(data?.items || []).length === 0 && <tr><td colSpan={5}><div className="empty-state"><div className="empty-state-icon"><svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg></div><div className="empty-state-title">{ar() ? "لا توجد مهام حالية" : "No active tasks"}</div><div className="empty-state-sub">{ar() ? "لا توجد مهام تتطلب اهتمامك الآن." : "All caught up — nothing to action right now."}</div></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
