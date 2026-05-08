// engineer.js

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Check
    const auth = await checkAuth('engineer');
    if (!auth) return;
    
    document.getElementById('engineerName').textContent = auth.profile.full_name;

    const engineerId = auth.user.id;
    let activeTaskId = null;
    let watchId = null;
    let mapInstance = null;

    // 1. Navigation Logic
    const btnActiveJobs = document.getElementById('btnActiveJobs');
    const btnJobHistory = document.getElementById('btnJobHistory');
    const activeJobsSection = document.getElementById('activeJobsSection');
    const jobHistorySection = document.getElementById('jobHistorySection');
    const sectionTitle = document.getElementById('currentSectionTitle');

    btnActiveJobs.onclick = () => {
        btnActiveJobs.classList.add('active');
        btnJobHistory.classList.remove('active');
        activeJobsSection.classList.remove('hidden');
        jobHistorySection.classList.add('hidden');
        sectionTitle.textContent = "My Assignments";
        loadTasks();
    };

    btnJobHistory.onclick = () => {
        btnJobHistory.classList.add('active');
        btnActiveJobs.classList.remove('active');
        jobHistorySection.classList.remove('hidden');
        activeJobsSection.classList.add('hidden');
        sectionTitle.textContent = "Job History";
        loadHistory();
    };

    // 2. Load Tasks
    async function loadTasks() {
        try {
            const { data: tasks, error } = await supabaseClient
                .from('tasks')
                .select('*')
                .eq('assigned_to', engineerId)
                .neq('status', 'Leave Site') 
                .order('created_at', { ascending: false });

            if (error) throw error;

            const container = document.getElementById('tasksContainer');
            
            if (tasks.length === 0) {
                container.innerHTML = `
                    <div class="text-center text-muted" style="padding: 3rem; background: white; border-radius: 12px;">
                        <i class="fa-solid fa-mug-hot" style="font-size: 3rem; margin-bottom: 1rem; color: #ccc;"></i>
                        <h3>No Active Assignments</h3>
                        <p>You have no pending tasks assigned at the moment.</p>
                    </div>`;
                return;
            }

            container.innerHTML = '';

            tasks.forEach(task => {
                const badgeClass = task.status === 'Assigned' ? 'badge-assigned' : 
                                   task.status === 'Trip Start' ? 'badge-progress' : 
                                   task.status === 'In Progress' ? 'badge-progress' : 'badge-completed';
                
                const isTrackingActive = (task.status === 'Trip Start' || task.status === 'In Progress');
                const isInProgress = task.status === 'In Progress';
                
                if (isTrackingActive) {
                    activeTaskId = task.id;
                    startTracking(task.id);
                }

                let actionsHtml = '';
                if (task.status === 'Assigned') {
                    actionsHtml = `
                        <button class="btn btn-primary btn-full" onclick="updateTaskStatus('${task.id}', 'Trip Start')">
                            <i class="fa-solid fa-truck-fast" style="margin-right: 0.5rem;"></i> Start Trip
                        </button>
                    `;
                } else if (task.status === 'Trip Start') {
                    actionsHtml = `
                        <button class="btn btn-primary btn-full" style="background: var(--accent); color: white;" onclick="updateTaskStatus('${task.id}', 'In Progress')">
                            <i class="fa-solid fa-location-dot" style="margin-right: 0.5rem;"></i> Reached Site
                        </button>
                    `;
                } else if (isInProgress) {
                    actionsHtml = `
                        <button class="btn btn-secondary btn-full" style="background: var(--secondary); color: white;" onclick="updateTaskStatus('${task.id}', 'Completed')">
                            <i class="fa-solid fa-check" style="margin-right: 0.5rem;"></i> Complete Work
                        </button>
                    `;
                } else if (task.status === 'Completed') {
                    actionsHtml = `
                        <button class="btn btn-primary btn-full" style="background: #333; color: white;" onclick="updateTaskStatus('${task.id}', 'Leave Site')">
                            <i class="fa-solid fa-door-open" style="margin-right: 0.5rem;"></i> Leave Site
                        </button>
                    `;
                }

                const card = document.createElement('div');
                card.className = 'task-card';
                card.innerHTML = `
                    <div class="task-header">
                        <h3 style="margin: 0; color: var(--primary);">${task.site_id}</h3>
                        <span class="badge ${badgeClass}">${task.status}</span>
                    </div>
                    <div class="task-body">
                        <p><strong><i class="fa-solid fa-building"></i> Customer:</strong> ${task.customer_name}</p>
                        <p><strong><i class="fa-solid fa-location-dot"></i> Address:</strong> ${task.address}</p>
                        <p><strong><i class="fa-solid fa-circle-exclamation"></i> Problem:</strong> ${task.problem_description}</p>
                        <p><strong><i class="fa-solid fa-flag"></i> Priority:</strong> <span style="text-transform: capitalize;">${task.priority}</span></p>
                    </div>
                    ${isInProgress ? '<div id="mobileMap-' + task.id + '" class="mobileMap" style="height: 200px; width: 100%; border-radius: 8px; margin-top: 1rem;"></div>' : ''}
                    <div class="task-actions">
                        ${actionsHtml}
                    </div>
                `;
                container.appendChild(card);

                // Initialize map if in progress
                if (isInProgress) {
                    setTimeout(() => {
                        initMap(`mobileMap-${task.id}`, task.lat, task.lng);
                    }, 100);
                }
            });

        } catch (err) {
            console.error("Error loading tasks:", err);
        }
    }

    // 3. Load History
    async function loadHistory(dateFilter = null) {
        try {
            let query = supabaseClient
                .from('tasks')
                .select('*')
                .eq('assigned_to', engineerId)
                .eq('status', 'Leave Site')
                .order('left_site_at', { ascending: false });

            if (dateFilter) {
                // Filter by left_site_at date
                query = query.gte('left_site_at', `${dateFilter}T00:00:00Z`)
                             .lte('left_site_at', `${dateFilter}T23:59:59Z`);
            }

            const { data: tasks, error } = await query;
            if (error) throw error;

            const container = document.getElementById('historyContainer');
            if (tasks.length === 0) {
                container.innerHTML = `<div class="text-center text-muted" style="padding: 3rem;">No completed tasks found for this period.</div>`;
                return;
            }

            container.innerHTML = '';
                tasks.forEach(task => {
                    const assigned = new Date(task.created_at).toLocaleString();
                    const tripStart = task.started_at ? new Date(task.started_at).toLocaleString() : 'N/A';
                    const reached = task.reached_site_at ? new Date(task.reached_site_at).toLocaleString() : 'N/A';
                    const finished = task.completed_at ? new Date(task.completed_at).toLocaleString() : 'N/A';
                    const leftSite = task.left_site_at ? new Date(task.left_site_at).toLocaleString() : 'N/A';
                    
                    const card = document.createElement('div');
                    card.className = 'task-card';
                    card.style.opacity = '0.9';
                    card.innerHTML = `
                        <div class="task-header">
                            <h3 style="margin: 0;">${task.site_id}</h3>
                            <span class="badge badge-completed">HISTORY</span>
                        </div>
                        <div class="task-body">
                            <p><strong>Customer:</strong> ${task.customer_name}</p>
                            <p><strong>Problem:</strong> ${task.problem_description}</p>
                            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                                <div><i class="fa-solid fa-calendar-plus"></i> Assigned:<br>${assigned}</div>
                                <div><i class="fa-solid fa-truck-fast"></i> Trip Start:<br>${tripStart}</div>
                                <div><i class="fa-solid fa-location-dot"></i> Reached Site:<br>${reached}</div>
                                <div><i class="fa-solid fa-calendar-check"></i> Completed:<br>${finished}</div>
                                <div><i class="fa-solid fa-door-open"></i> Left Site:<br>${leftSite}</div>
                            </div>
                        </div>
                    `;
                    container.appendChild(card);
                });
        } catch (err) {
            console.error("Error loading history:", err);
        }
    }

    // History Filter Listeners
    document.getElementById('historyDateFilter').onchange = (e) => {
        loadHistory(e.target.value);
    };

    document.getElementById('clearFilterBtn').onclick = () => {
        document.getElementById('historyDateFilter').value = '';
        loadHistory();
    };

    // 3. Map Initialization (for In Progress tasks)
    function initMap(elementId, taskLat, taskLng) {
        if (mapInstance) mapInstance.remove();

        mapInstance = L.map(elementId).setView([taskLat, taskLng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap'
        }).addTo(mapInstance);

        const taskIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41]
        });

        L.marker([taskLat, taskLng], {icon: taskIcon}).addTo(mapInstance)
            .bindPopup('Task Location').openPopup();
    }

    // Helper to get current location
    function getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported'));
            }
            navigator.geolocation.getCurrentPosition(
                (position) => resolve(position),
                (error) => reject(error),
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        });
    }

    // 4. Update Status (Global function to be called from inline onclick)
    window.updateTaskStatus = async (taskId, newStatus) => {
        try {
            const updates = { status: newStatus };
            
            // Try to get location for status transitions
            let position = null;
            try {
                position = await getCurrentLocation();
            } catch (locErr) {
                console.warn("Could not capture location for status change:", locErr);
            }

            if (newStatus === 'Trip Start') {
                updates.started_at = new Date().toISOString();
                if (position) {
                    updates.start_lat = position.coords.latitude;
                    updates.start_lng = position.coords.longitude;
                }
            } else if (newStatus === 'In Progress') {
                updates.reached_site_at = new Date().toISOString();
            } else if (newStatus === 'Completed') {
                updates.completed_at = new Date().toISOString();
                if (position) {
                    updates.end_lat = position.coords.latitude;
                    updates.end_lng = position.coords.longitude;
                }
            } else if (newStatus === 'Leave Site') {
                updates.left_site_at = new Date().toISOString();
            }

            const { error } = await supabaseClient
                .from('tasks')
                .update(updates)
                .eq('id', taskId);

            if (error) throw error;

            if (newStatus === 'Leave Site') {
                stopTracking();
            }

            loadTasks();
        } catch (err) {
            console.error("Failed to update status:", err);
            alert("Failed to update task status.");
        }
    };

    // 5. Geolocation Tracking
    function startTracking(taskId) {
        if (watchId !== null) return; // Already tracking
        
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }

        document.getElementById('trackingIndicator').classList.add('active');

        watchId = navigator.geolocation.watchPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                // Send to Supabase
                try {
                    await supabaseClient.from('tracking').insert([
                        {
                            engineer_id: engineerId,
                            task_id: taskId,
                            lat: lat,
                            lng: lng
                        }
                    ]);
                    console.log("Location updated", lat, lng);
                } catch (err) {
                    console.error("Failed to update location to DB", err);
                }
            },
            (error) => {
                console.error("Geolocation error:", error);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 10000,
                timeout: 10000
            }
        );
    }

    function stopTracking() {
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
        document.getElementById('trackingIndicator').classList.remove('active');
        activeTaskId = null;
    }

    // Initial load
    loadTasks();
});
