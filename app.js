import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, remove, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

// Firebase Configuration (Provided by USER)
const firebaseConfig = {
    apiKey: "AIzaSyBpklAJvjynqiCsw1b5aejcuhtTydW4aQQ",
    authDomain: "todo-test-backend.firebaseapp.com",
    projectId: "todo-test-backend",
    databaseURL: "https://todo-test-backend-default-rtdb.asia-southeast1.firebasedatabase.app/",
    storageBucket: "todo-test-backend.firebasestorage.app",
    messagingSenderId: "907127729868",
    appId: "1:907127729868:web:ef845db6faaa67cdaedc69"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const dbRef = ref(db, 'todos');

// DOM Elements
const todoInput = document.getElementById('todoInput');
const isRoutineToggle = document.getElementById('isRoutine');
const todoDeadline = document.getElementById('todoDeadline');
const addBtn = document.getElementById('addBtn');
const routineList = document.getElementById('routineList');
const oneOffList = document.getElementById('oneOffList');
const currentDateEl = document.getElementById('currentDate');
const alertModal = document.getElementById('alertModal');
const closeModalBtn = document.getElementById('closeModal');
const deadlineWrapper = document.getElementById('deadlineWrapper');

// State
let todos = [];
let lastAlertTime = Date.now(); // Initialize with app load time
let isRoutineDelayed = false;   // Track if routines should highlight

// Initialize Date Display
const updateDateDisplay = () => {
    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    currentDateEl.textContent = now.toLocaleDateString('ko-KR', options);
};

// --- Firebase Operations ---

const addTodo = () => {
    const title = todoInput.value.trim();
    if (!title) return;

    const isRoutine = isRoutineToggle.checked;
    const deadline = todoDeadline.value;

    const newTodo = {
        title,
        isRoutine,
        deadline: deadline || null,
        completed: false,
        createdAt: serverTimestamp(),
        lastCompletedDate: null // For routines
    };

    const newTodoRef = push(dbRef);
    set(newTodoRef, newTodo);

    // Reset Input
    todoInput.value = '';
    todoDeadline.value = '';
    isRoutineToggle.checked = false;
    deadlineWrapper.classList.remove('hidden');
};

const toggleTodo = (id, currentStatus, isRoutine) => {
    const todoRef = ref(db, `todos/${id}`);
    const updates = { completed: !currentStatus };
    
    if (isRoutine && !currentStatus) {
        updates.lastCompletedDate = new Date().toDateString();
        // If all routines are completed, we can potentially stop the highlight
        // but it will re-check in the next loop.
    }
    
    update(todoRef, updates);
};

const deleteTodo = (id) => {
    if (confirm('정말 삭제하시겠습니까?')) {
        const todoRef = ref(db, `todos/${id}`);
        remove(todoRef).catch(err => console.error("삭제 실패:", err));
    }
};

const updateTodoTitle = (id) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    
    const newTitle = prompt('할일을 수정하세요:', todo.title);
    if (newTitle && newTitle.trim() && newTitle !== todo.title) {
        const todoRef = ref(db, `todos/${id}`);
        update(todoRef, { title: newTitle.trim() }).catch(err => console.error("수정 실패:", err));
    }
};

// Expose handlers to window for onclick (Moved up to ensure availability)
window.handleToggle = toggleTodo;
window.handleDelete = deleteTodo;
window.handleEdit = updateTodoTitle;

// --- Logic & Rendering ---

let renderTimeout;
const requestRender = () => {
    if (renderTimeout) clearTimeout(renderTimeout);
    renderTimeout = setTimeout(renderTodos, 50); // 50ms debounce
};

const calculateDeadlineStyle = (deadlineStr) => {
    if (!deadlineStr) return '';

    const deadline = new Date(deadlineStr).getTime();
    const now = new Date().getTime();
    const diff = deadline - now;
    const oneDay = 24 * 60 * 60 * 1000;
    const twoHours = 2 * 60 * 60 * 1000;

    if (diff <= 0) {
        return 'color: #f87171; font-weight: 800; text-shadow: 0 0 10px rgba(239, 68, 68, 0.3);';
    }

    if (diff <= twoHours) {
        const ratio = 1 - (diff / twoHours);
        const r = 239, g = Math.floor(68 * (1 - ratio)), b = Math.floor(68 * (1 - ratio));
        return `color: rgb(${r}, ${g}, ${b}); font-weight: ${700 + Math.floor(ratio * 100)}; text-shadow: 0 0 ${ratio * 8}px rgba(239, 68, 68, 0.4);`;
    }

    if (diff <= oneDay) {
        const ratio = 1 - (diff / oneDay);
        const r = 245, g = Math.floor(200 - (ratio * 100)), b = 10;
        return `color: rgb(${r}, ${g}, ${b}); font-weight: ${500 + Math.floor(ratio * 200)};`;
    }

    return '';
};

// --- Init & Data Listeners ---

onValue(dbRef, (snapshot) => {
    const data = snapshot.val();
    const todayString = new Date().toDateString();
    const newTodos = [];
    const batchUpdates = {};
    
    if (data) {
        Object.keys(data).forEach(key => {
            const item = data[key];
            
            // --- AUTOMATIC DAILY RESET (BATCHED) ---
            if (item.isRoutine && item.completed && item.lastCompletedDate !== todayString) {
                batchUpdates[`${key}/completed`] = false;
            } else {
                newTodos.push({ id: key, ...item });
            }
        });

        if (Object.keys(batchUpdates).length > 0) {
            update(dbRef, batchUpdates).catch(err => console.error("일괄 리셋 실패:", err));
        }
    }
    
    // Stabilize state before rendering
    todos = newTodos;
    requestRender();
});

const renderTodos = () => {
    routineList.innerHTML = '';
    oneOffList.innerHTML = '';

    const now = Date.now();
    const todayString = new Date().toDateString();
    const fifteenMinutes = 15 * 60 * 1000;
    
    let routinesFound = false;
    let oneOffsFound = false;

    todos.forEach(todo => {
        const { id, title, isRoutine, deadline, completed, createdAt, lastCompletedDate } = todo;
        
        const isTaskCompleted = completed;
        const dateStr = createdAt ? new Date(createdAt).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';
        const deadlineStyle = calculateDeadlineStyle(deadline);
        
        // Alert classes logic
        let alertClass = '';
        if (!isTaskCompleted) {
            if (isRoutine) {
                // HIGHLIGHT LOGIC:
                // 1. If carried over from yesterday (lastCompletedDate != todayString AND it's NOT a brand new task)
                // 2. OR 15 minutes have passed since lastAlertTime (global)
                // 3. OR 15 minutes have passed since it was created today
                const isCarriedOver = lastCompletedDate && lastCompletedDate !== todayString;
                const timeSinceCreated = now - (createdAt || now);
                
                if (isCarriedOver || isRoutineDelayed || timeSinceCreated >= fifteenMinutes) {
                    alertClass = 'blink-rainbow';
                }
            } else if (deadline && new Date(deadline).getTime() <= now) {
                alertClass = 'blink-warning';
            }
        }

        const todoHtml = `
            <div class="todo-card ${isTaskCompleted ? 'completed' : ''} ${alertClass}" id="todo-${id}">
                <div class="todo-content">
                    <div class="todo-title" style="${deadlineStyle}">${title}</div>
                    <div class="todo-meta">
                        <span>🕒 ${dateStr}</span>
                        ${deadline ? `<span>📅 ${new Date(deadline).toLocaleString('ko-KR')}</span>` : ''}
                    </div>
                </div>
                <div class="todo-actions">
                    <button class="icon-btn check" data-id="${id}" data-action="toggle" data-completed="${isTaskCompleted}" data-routine="${isRoutine}">
                        <span>${isTaskCompleted ? '✓' : '○'}</span>
                    </button>
                    <button class="icon-btn edit" data-id="${id}" data-action="edit">
                        <span>✏️</span>
                    </button>
                    <button class="icon-btn delete" data-id="${id}" data-action="delete">
                        <span>🗑️</span>
                    </button>
                </div>
            </div>
        `;

        if (isRoutine) {
            routineList.insertAdjacentHTML('beforeend', todoHtml);
            routinesFound = true;
        } else {
            oneOffList.insertAdjacentHTML('beforeend', todoHtml);
            oneOffsFound = true;
        }
    });

    if (!routinesFound) routineList.innerHTML = '<div class="empty-state">루틴을 등록해보세요.</div>';
    if (!oneOffsFound) oneOffList.innerHTML = '<div class="empty-state">할일을 등록해보세요.</div>';
};

// --- Event Delegation ---

const handleListClick = (e) => {
    const btn = e.target.closest('.icon-btn');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'toggle') {
        const completed = btn.dataset.completed === 'true';
        const isRoutine = btn.dataset.routine === 'true';
        toggleTodo(id, completed, isRoutine);
    } else if (action === 'edit') {
        updateTodoTitle(id);
    } else if (action === 'delete') {
        deleteTodo(id);
    }
};

// --- Monitoring & Alerts ---

const checkRoutineAlerts = () => {
    const now = Date.now();
    const fifteenMinutes = 15 * 60 * 1000;

    if (now - lastAlertTime >= fifteenMinutes) {
        const uncompletedRoutines = todos.filter(t => t.isRoutine && !t.completed);

        if (uncompletedRoutines.length > 0) {
            // Show modal if it's hidden
            if (alertModal.classList.contains('hidden')) {
                alertModal.classList.remove('hidden');
            }
            lastAlertTime = now;
            isRoutineDelayed = true;
            requestRender(); 
        } else {
            isRoutineDelayed = false;
        }
    }
};

// Event Listeners
addBtn.addEventListener('click', addTodo);
todoInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTodo(); });
closeModalBtn.addEventListener('click', () => alertModal.classList.add('hidden'));

// Delegation Listeners
routineList.addEventListener('click', handleListClick);
oneOffList.addEventListener('click', handleListClick);

isRoutineToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
        deadlineWrapper.classList.add('hidden');
        todoDeadline.value = '';
    } else {
        deadlineWrapper.classList.remove('hidden');
    }
});

// System Loops
updateDateDisplay();
setInterval(updateDateDisplay, 60000);
setInterval(requestRender, 5000); // 5s debounced re-render
setInterval(checkRoutineAlerts, 10000);

// Initial alert suppression for first 15 mins of opening
lastAlertTime = Date.now();
