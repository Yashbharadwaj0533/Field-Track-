// admin.js

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Check
    const auth = await checkAuth('admin');
    if (!auth) return;
    
    document.getElementById('adminName').textContent = auth.profile.full_name;

    // 2. Initialize Map
    const map = L.map('map').setView([20.5937, 78.9629], 5); // Default to center of India, adjust as needed

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const markers = {}; // Store engineer tracking markers
    const taskMarkers = {}; // Store task site markers

    // Custom Icons
    const engineerIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    const taskIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    // Custom Icons for Start and End
    const startIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [20, 32],
        iconAnchor: [10, 32],
        popupAnchor: [1, -34]
    });

    const endIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [20, 32],
        iconAnchor: [10, 32],
        popupAnchor: [1, -34]
    });

    // 3. Navigation & Section Toggling
    const navDashboard = document.getElementById('navDashboard');
    const navEngineers = document.getElementById('navEngineers');
    const dashboardSection = document.getElementById('dashboardSection');
    const engineersSection = document.getElementById('engineersSection');
    const pageTitle = document.getElementById('pageTitle');

    navDashboard.onclick = () => {
        navDashboard.classList.add('active');
        navEngineers.classList.remove('active');
        dashboardSection.classList.remove('hidden');
        engineersSection.classList.add('hidden');
        pageTitle.textContent = "Dashboard Overview";
        loadDashboard();
    };

    navEngineers.onclick = () => {
        navEngineers.classList.add('active');
        navDashboard.classList.remove('active');
        engineersSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
        pageTitle.textContent = "Engineer Management";
        loadEngineers();
    };

    // 4. Load Dashboard Data
    async function loadDashboard() {
        try {
            // Load Engineers Count
            const { count: engCount } = await supabaseClient
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'engineer');
            
            document.getElementById('statEngineers').textContent = engCount || 0;

            // Load Tasks
            const { data: tasks, error: tasksError } = await supabaseClient
                .from('tasks')
                .select(`
                    id, site_id, customer_name, status, priority, lat, lng,
                    start_lat, start_lng, end_lat, end_lng,
                    assigned_to, profiles (full_name)
                `)
                .order('created_at', { ascending: false });
                
            if (tasksError) throw tasksError;

            let inProgress = 0;
            const tableBody = document.getElementById('tasksTableBody');
            tableBody.innerHTML = '';

            tasks.forEach(task => {
                // Update stats
                if (task.status === 'In Progress') inProgress++;

                // 1. Task Site Marker
                if (!taskMarkers[task.id]) {
                    const marker = L.marker([task.lat, task.lng], {icon: taskIcon})
                        .bindPopup(`<b>Site: ${task.customer_name}</b><br>Status: ${task.status}`)
                        .addTo(map);
                    taskMarkers[task.id] = { site: marker };
                } else {
                    taskMarkers[task.id].site.setPopupContent(`<b>Site: ${task.customer_name}</b><br>Status: ${task.status}`);
                }

                // 2. Start Location Marker
                if (task.start_lat && task.start_lng) {
                    if (!taskMarkers[task.id].start) {
                        taskMarkers[task.id].start = L.marker([task.start_lat, task.start_lng], {icon: startIcon})
                            .bindPopup(`<b>Started Here</b><br>${task.customer_name}`)
                            .addTo(map);
                    }
                }

                // 3. End Location Marker
                if (task.end_lat && task.end_lng) {
                    if (!taskMarkers[task.id].end) {
                        taskMarkers[task.id].end = L.marker([task.end_lat, task.end_lng], {icon: endIcon})
                            .bindPopup(`<b>Completed Here</b><br>${task.customer_name}`)
                            .addTo(map);
                    }
                }

                // Add to table
                const badgeClass = task.status === 'Assigned' ? 'badge-assigned' : 
                                   (task.status === 'Trip Start' || task.status === 'In Progress') ? 'badge-progress' :
                                   task.status === 'Completed' ? 'badge-progress' : 'badge-completed'; // Completed but still on site is progress, Leave Site is final.
                
                let actionsHtml = '';
                if (task.status === 'Trip Start' && task.assigned_to) {
                    actionsHtml = `
                        <button class="btn btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="centerOnEngineer('${task.assigned_to}')">
                            <i class="fa-solid fa-location-crosshairs"></i> Live Track
                        </button>
                    `;
                }
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-family: monospace; font-size: 0.85rem;">${task.id.split('-')[0]}</td>
                    <td style="font-weight: 500;">${task.customer_name}</td>
                    <td>${task.profiles ? task.profiles.full_name : 'Unassigned'}</td>
                    <td><span class="badge ${badgeClass}">${task.status}</span></td>
                    <td style="text-transform: capitalize;">${task.priority}</td>
                    <td>${actionsHtml}</td>
                `;
                tableBody.appendChild(tr);
            });

            document.getElementById('statInProgress').textContent = inProgress;
            const completedCount = tasks.filter(t => t.status === 'Leave Site').length;
            document.getElementById('statCompleted').textContent = completedCount;

            if (tasks.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No tasks found</td></tr>';
            }

        } catch (err) {
            console.error("Error loading dashboard:", err);
            showToast("Failed to load dashboard data");
        }
    }

    // 5. Load Engineers Data
    async function loadEngineers() {
        try {
            // Fetch profiles
            const { data: engineers, error: engError } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('role', 'engineer');
            
            if (engError) throw engError;

            // Fetch task counts for each engineer
            const { data: allTasks } = await supabaseClient
                .from('tasks')
                .select('assigned_to');

            const tableBody = document.getElementById('engineersTableBody');
            tableBody.innerHTML = '';

            engineers.forEach(eng => {
                const ticketCount = allTasks ? allTasks.filter(t => t.assigned_to === eng.id).length : 0;
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${eng.full_name}</strong></td>
                    <td style="font-size: 0.85rem; color: var(--text-muted);">${eng.id}</td>
                    <td class="text-center">${ticketCount}</td>
                    <td><span class="badge badge-assigned">Active</span></td>
                    <td>
                        <div class="flex gap-2">
                            <button class="btn btn-outline" style="padding: 0.4rem 0.8rem;" onclick="viewEngineerHistory('${eng.id}', '${eng.full_name}')" title="View History">
                                <i class="fa-solid fa-history"></i>
                            </button>
                            <button class="btn btn-outline" style="padding: 0.4rem 0.8rem;" onclick="openEditEngModal('${eng.id}', '${eng.full_name}')" title="Edit Profile">
                                <i class="fa-solid fa-user-pen"></i>
                            </button>
                            <button class="btn btn-outline" style="color: var(--danger); border-color: var(--danger); padding: 0.4rem 0.8rem;" onclick="deleteEngineer('${eng.id}')" title="Delete">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
                tableBody.appendChild(tr);
            });

            if (engineers.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No engineers found</td></tr>';
            }

        } catch (err) {
            console.error("Error loading engineers:", err);
            showToast("Failed to load engineers");
        }
    }

    // Edit Engineer
    window.openEditEngModal = (id, name) => {
        document.getElementById('editEngId').value = id;
        document.getElementById('editEngName').value = name;
        document.getElementById('editEngModal').style.display = 'block';
    };

    // View History
    window.viewEngineerHistory = async (id, name) => {
        document.getElementById('historyModalTitle').textContent = `${name}'s Task History`;
        const tableBody = document.getElementById('engHistoryTableBody');
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center">Loading history...</td></tr>';
        document.getElementById('historyModal').style.display = 'block';

        try {
            const { data: tasks, error } = await supabaseClient
                .from('tasks')
                .select('*')
                .eq('assigned_to', id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            tableBody.innerHTML = '';
            if (tasks.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No task history found</td></tr>';
                return;
            }

            tasks.forEach(task => {
                const assigned = new Date(task.created_at).toLocaleString();
                const trip = task.started_at ? new Date(task.started_at).toLocaleTimeString() : '-';
                const reached = task.reached_site_at ? new Date(task.reached_site_at).toLocaleTimeString() : '-';
                const finished = task.completed_at ? new Date(task.completed_at).toLocaleTimeString() : '-';
                const left = task.left_site_at ? new Date(task.left_site_at).toLocaleTimeString() : '-';
                
                const badgeClass = task.status === 'Leave Site' ? 'badge-completed' : 'badge-progress';
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-family: monospace; font-size: 0.8rem;">${task.id.split('-')[0]}</td>
                    <td>
                        <strong>${task.customer_name}</strong><br>
                        <span class="badge ${badgeClass}" style="font-size: 0.7rem;">${task.status}</span>
                    </td>
                    <td colspan="2">
                        <div style="font-size: 0.75rem; color: var(--text-muted); display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                            <span>Assigned: ${new Date(task.created_at).toLocaleDateString()}</span>
                            <span>Trip: ${trip}</span>
                            <span>Site: ${reached}</span>
                            <span>Work: ${finished}</span>
                            <span>Left: ${left}</span>
                        </div>
                    </td>
                `;
                tableBody.appendChild(tr);
            });
        } catch (err) {
            console.error("History load failed:", err);
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Failed to load history</td></tr>';
        }
    };

    // Delete Engineer
    window.deleteEngineer = async (id) => {
        if (!confirm("Are you sure you want to delete this engineer? This will NOT delete their auth account but will remove their profile.")) return;
        
        try {
            const { error } = await supabaseClient.from('profiles').delete().eq('id', id);
            if (error) throw error;
            showToast("Engineer profile deleted");
            loadEngineers();
        } catch (err) {
            console.error("Delete failed:", err);
            showToast("Failed to delete engineer");
        }
    };

    // Helper for Live Tracking
    window.centerOnEngineer = (engineerId) => {
        if (markers[engineerId]) {
            map.setView(markers[engineerId].getLatLng(), 15);
            markers[engineerId].openPopup();
        } else {
            showToast("Engineer location not available yet.");
        }
    };

    // 6. Modal Logic (Tasks)
    const modal = document.getElementById('taskModal');
    const openBtn = document.getElementById('openTaskModalBtn');
    const closeBtn = document.getElementById('closeTaskModal');
    const cancelBtn = document.getElementById('cancelTaskBtn');

    openBtn.onclick = async () => {
        const { data: engineers } = await supabaseClient.from('profiles').select('id, full_name').eq('role', 'engineer');
        const select = document.getElementById('taskAssignee');
        select.innerHTML = '<option value="">Select an engineer...</option>';
        if (engineers) engineers.forEach(e => select.innerHTML += `<option value="${e.id}">${e.full_name}</option>`);
        modal.style.display = 'block';
    };

    closeBtn.onclick = () => modal.style.display = 'none';
    cancelBtn.onclick = () => modal.style.display = 'none';

    // 7. Modal Logic (Engineers)
    const engModal = document.getElementById('engModal');
    const openEngBtn = document.getElementById('openEngModalBtn');
    const closeEngBtn = document.getElementById('closeEngModal');
    const cancelEngBtn = document.getElementById('cancelEngBtn');

    const editEngModal = document.getElementById('editEngModal');
    const closeEditEngBtn = document.getElementById('closeEditEngModal');
    const cancelEditEngBtn = document.getElementById('cancelEditEngBtn');

    const historyModal = document.getElementById('historyModal');
    const closeHistoryBtn = document.getElementById('closeHistoryModal');

    openEngBtn.onclick = () => engModal.style.display = 'block';
    closeEngBtn.onclick = () => engModal.style.display = 'none';
    cancelEngBtn.onclick = () => engModal.style.display = 'none';

    closeEditEngBtn.onclick = () => editEngModal.style.display = 'none';
    cancelEditEngBtn.onclick = () => editEngModal.style.display = 'none';

    closeHistoryBtn.onclick = () => historyModal.style.display = 'none';

    window.onclick = (e) => { 
        if (e.target == modal) modal.style.display = 'none'; 
        if (e.target == engModal) engModal.style.display = 'none';
        if (e.target == editEngModal) editEngModal.style.display = 'none';
        if (e.target == historyModal) historyModal.style.display = 'none';
    }

    // 8. Form Submissions
    document.getElementById('createTaskForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('saveTaskBtn');
        saveBtn.disabled = true; saveBtn.textContent = 'Assigning...';

        const taskData = {
            site_id: 'SITE-' + Math.floor(Math.random() * 10000),
            customer_name: document.getElementById('taskCustomer').value,
            address: document.getElementById('taskAddress').value,
            lat: 28.6139, lng: 77.2090,
            problem_description: document.getElementById('taskDesc').value,
            priority: document.getElementById('taskPriority').value,
            assigned_to: document.getElementById('taskAssignee').value,
            status: 'Assigned'
        };

        try {
            const { error } = await supabaseClient.from('tasks').insert([taskData]);
            if (error) throw error;
            showToast("Task assigned successfully!");
            modal.style.display = 'none';
            document.getElementById('createTaskForm').reset();
            loadDashboard();
        } catch (err) {
            console.error("Task creation failed:", err);
            showToast("Failed to assign task");
        } finally {
            saveBtn.disabled = false; saveBtn.textContent = 'Assign Task';
        }
    });

    document.getElementById('editEngForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('saveEditEngBtn');
        saveBtn.disabled = true; saveBtn.textContent = 'Updating...';

        const id = document.getElementById('editEngId').value;
        const name = document.getElementById('editEngName').value;

        try {
            const { error } = await supabaseClient
                .from('profiles')
                .update({ full_name: name })
                .eq('id', id);
            
            if (error) throw error;

            showToast("Engineer profile updated!");
            document.getElementById('editEngModal').style.display = 'none';
            loadEngineers();
        } catch (err) {
            console.error("Update failed:", err);
            showToast("Failed to update profile");
        } finally {
            saveBtn.disabled = false; saveBtn.textContent = 'Update Profile';
        }
    });

    document.getElementById('addEngForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('saveEngBtn');
        saveBtn.disabled = true; saveBtn.textContent = 'Creating...';

        const email = document.getElementById('engEmail').value;
        const pass = document.getElementById('engPass').value;
        const name = document.getElementById('engName').value;

        try {
            // 1. Sign up user
            const { data, error } = await supabaseClient.auth.signUp({
                email, password: pass,
                options: { data: { full_name: name, role: 'engineer' } }
            });
            
            if (error) throw error;

            // 2. Profile creation (Trigger should handle this, but adding manually if needed)
            const { error: profError } = await supabaseClient.from('profiles').insert([
                { id: data.user.id, full_name: name, role: 'engineer' }
            ]);
            // If profError is 'duplicate', it means the trigger already did it, which is fine.

            showToast("Engineer account created!");
            engModal.style.display = 'none';
            document.getElementById('addEngForm').reset();
            loadEngineers();
        } catch (err) {
            console.error("Engineer creation failed:", err);
            showToast("Failed to create engineer: " + err.message);
        } finally {
            saveBtn.disabled = false; saveBtn.textContent = 'Create Engineer';
        }
    });

    // 9. Realtime Tracking Updates
    function subscribeToTracking() {
        supabaseClient.channel('custom-tracking-channel')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tracking' }, (payload) => {
                const newLoc = payload.new;
                if (markers[newLoc.engineer_id]) markers[newLoc.engineer_id].setLatLng([newLoc.lat, newLoc.lng]);
                else markers[newLoc.engineer_id] = L.marker([newLoc.lat, newLoc.lng], {icon: engineerIcon}).bindPopup(`Engineer Location`).addTo(map);
            }).subscribe();
            
        supabaseClient.channel('custom-task-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadDashboard()).subscribe();
    }

    // Helper: Toast
    function showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message; toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // Initial Load
    loadDashboard();
    subscribeToTracking();
});
