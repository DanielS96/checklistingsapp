// Cloudflare Worker - Checklistings
// Полная версия с платежами, трекингом и аналитикой

const BOT_TOKEN = 'TOKEN';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
};

export default {
    async fetch(request, env, ctx) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);
        const path = url.pathname;

        switch (path) {
            case '/test':
                return new Response(JSON.stringify({ status: 'ok', timestamp: Date.now() }), { headers: corsHeaders });

            case '/api/create-invoice':
                return handleCreateInvoice(request);

            case '/api/verify-payment':
                return handleVerifyPayment(request, env);

            case '/api/get-purchases':
                return handleGetPurchases(request, env);

            case '/api/track-user':
                return handleTrackUser(request, env);

            case '/api/track-event':
                return handleTrackEvent(request, env);

            case '/api/track-progress':
                return handleTrackProgress(request, env);

            case '/api/admin/stats':
                return handleAdminStats(request, env);

            case '/webhook':
                return handleWebhook(request, env);

            default:
                return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders });
        }
    }
};

// Трекинг пользователей
async function handleTrackUser(request, env) {
    try {
        const body = await request.json();
        const { user_id, username, first_name } = body;
        if (!user_id) return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400, headers: corsHeaders });

        if (env?.USERS) {
            const key = `user:${user_id}`;
            const existing = await env.USERS.get(key);
            if (!existing) {
                await env.USERS.put(key, JSON.stringify({
                    user_id, username: username || '', first_name: first_name || '',
                    first_seen: Date.now(), last_seen: Date.now(), visit_count: 1
                }));
            } else {
                const data = JSON.parse(existing);
                data.last_seen = Date.now();
                data.visit_count = (data.visit_count || 0) + 1;
                if (username) data.username = username;
                if (first_name) data.first_name = first_name;
                await env.USERS.put(key, JSON.stringify(data));
            }
        }
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
}

// Трекинг событий
async function handleTrackEvent(request, env) {
    try {
        const body = await request.json();
        const { user_id, event, data } = body;
        if (!user_id || !event) return new Response(JSON.stringify({ error: 'user_id and event required' }), { status: 400, headers: corsHeaders });

        if (env?.ANALYTICS) {
            const ts = Date.now();
            await env.ANALYTICS.put(`event:${user_id}:${ts}`, JSON.stringify({
                user_id, event, data: data || {}, timestamp: ts, date: new Date(ts).toISOString()
            }));
        }
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
}

// Трекинг прохождений
async function handleTrackProgress(request, env) {
    try {
        const body = await request.json();
        const { user_id, checklist_id, checklist_title } = body;
        if (!user_id || !checklist_id) return new Response(JSON.stringify({ error: 'user_id and checklist_id required' }), { status: 400, headers: corsHeaders });

        if (env?.PROGRESS) {
            const key = `progress:${checklist_id}:${user_id}`;
            await env.PROGRESS.put(key, JSON.stringify({
                user_id, checklist_id, checklist_title: checklist_title || checklist_id,
                completed: true, completed_at: Date.now(), date: new Date().toISOString()
            }));
        }
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
}

// Создание инвойса
async function handleCreateInvoice(request) {
    try {
        const body = await request.json();
        const { user_id, title, description, payload, prices } = body;

        const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title.substring(0, 32),
                description: description.substring(0, 255),
                payload, provider_token: '', currency: 'XTR', prices,
                max_tip_amount: 0, suggested_tip_amounts: [],
                need_name: false, need_phone_number: false, need_email: false,
                need_shipping_address: false, is_flexible: false
            })
        });

        const data = await resp.json();
        if (!data.ok) {
            return new Response(JSON.stringify({ error: 'Telegram API error', details: data.description }), { status: 500, headers: corsHeaders });
        }
        return new Response(JSON.stringify({ success: true, invoice_url: data.result }), { headers: corsHeaders });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
}

// Проверка платежа
async function handleVerifyPayment(request, env) {
    try {
        const { user_id, checklist_id } = await request.json();
        if (env?.PAYMENTS) {
            const data = await env.PAYMENTS.get(`payment:${checklist_id}:${user_id}`);
            if (data) {
                const p = JSON.parse(data);
                return new Response(JSON.stringify({ paid: p.status === 'completed', details: p }), { headers: corsHeaders });
            }
        }
        return new Response(JSON.stringify({ paid: false }), { headers: corsHeaders });
    } catch (e) {
        return new Response(JSON.stringify({ paid: false, error: e.message }), { headers: corsHeaders });
    }
}

// Получение покупок
async function handleGetPurchases(request, env) {
    try {
        const user_id = new URL(request.url).searchParams.get('user_id');
        const purchases = [];
        if (env?.PAYMENTS && user_id) {
            const list = await env.PAYMENTS.list({ prefix: 'payment:' });
            for (const key of list.keys) {
                if (key.name.includes(`:${user_id}`)) {
                    const data = await env.PAYMENTS.get(key.name);
                    if (data) {
                        const p = JSON.parse(data);
                        if (p.status === 'completed') purchases.push({ checklist_id: p.checklist_id, amount: p.amount, payment_date: p.payment_date });
                    }
                }
            }
        }
        return new Response(JSON.stringify({ purchases }), { headers: corsHeaders });
    } catch (e) {
        return new Response(JSON.stringify({ purchases: [], error: e.message }), { headers: corsHeaders });
    }
}

// Админка
async function handleAdminStats(request, env) {
    try {
        const payments = [];
        const salesByDay = {};

        // 1. Платежи
        if (env?.PAYMENTS) {
            const list = await env.PAYMENTS.list({ prefix: 'payment:' });
            for (const key of list.keys) {
                const data = await env.PAYMENTS.get(key.name);
                if (data) {
                    const p = JSON.parse(data);
                    if (p.status === 'completed') {
                        payments.push(p);
                        const day = new Date(p.payment_date).toLocaleDateString('ru-RU');
                        if (!salesByDay[day]) salesByDay[day] = { date: day, count: 0, revenue: 0 };
                        salesByDay[day].count++;
                        salesByDay[day].revenue += p.amount || 0;
                    }
                }
            }
        }

        // 2. Прохождения
        const completionsMap = {};
        const completedSet = new Set();
        if (env?.PROGRESS) {
            const list = await env.PROGRESS.list({ prefix: 'progress:' });
            for (const key of list.keys) {
                const data = await env.PROGRESS.get(key.name);
                if (data) {
                    const prog = JSON.parse(data);
                    const clId = prog.checklist_id;
                    completedSet.add(`${prog.user_id}:${clId}`);
                    if (!completionsMap[clId]) {
                        completionsMap[clId] = { checklist_id: clId, title: prog.checklist_title || clId, completions: 0, revenue: 0 };
                    }
                    completionsMap[clId].completions++;
                }
            }
        }

        // 3. Открытия и категории
        const openedMap = {};
        const categoriesMap = {};
        if (env?.ANALYTICS) {
            const list = await env.ANALYTICS.list({ prefix: 'event:' });
            for (const key of list.keys) {
                const data = await env.ANALYTICS.get(key.name);
                if (data) {
                    const event = JSON.parse(data);
                    if (event.event === 'checklist_open' && event.data?.checklist_id) {
                        const clId = event.data.checklist_id;
                        const clTitle = event.data.checklist_title || clId;
                        const done = completedSet.has(`${event.user_id}:${clId}`);
                        
                        if (!openedMap[clId]) {
                            openedMap[clId] = { checklist_id: clId, title: clTitle, opens: 0, not_completed: 0 };
                        }
                        openedMap[clId].opens++;
                        if (!done) openedMap[clId].not_completed++;
                        
                        if (event.data.category_id) {
                            const catId = event.data.category_id;
                            if (!categoriesMap[catId]) {
                                categoriesMap[catId] = {
                                    category: catId,
                                    title: event.data.category_title || catId,
                                    icon: event.data.category_icon || '',
                                    opens: 0
                                };
                            }
                            categoriesMap[catId].opens++;
                        }
                    }
                }
            }
        }

        // Добавляем выручку
        payments.forEach(p => {
            if (completionsMap[p.checklist_id]) completionsMap[p.checklist_id].revenue += p.amount || 0;
        });

        // 4. Пользователи
        const usersMap = {};
        let totalUsers = 0, returningUsers = 0, totalVisits = 0;
        if (env?.USERS) {
            const list = await env.USERS.list();
            totalUsers = list.keys.length;
            for (const key of list.keys) {
                const data = await env.USERS.get(key.name);
                if (data) {
                    const u = JSON.parse(data);
                    usersMap[u.user_id] = u;
                    totalVisits += u.visit_count || 1;
                    if ((u.visit_count || 1) > 1) returningUsers++;
                }
            }
        }

        return new Response(JSON.stringify({
            total_users: totalUsers,
            returning_users: returningUsers,
            unique_buyers: new Set(payments.map(p => p.user_id)).size,
            total_sales: payments.length,
            total_revenue: payments.reduce((s, p) => s + (p.amount || 0), 0),
            avg_visits: totalUsers > 0 ? Math.round(totalVisits / totalUsers) : 0,
            sales_by_day: Object.values(salesByDay).sort((a, b) => a.date.localeCompare(b.date)),
            ranking: Object.values(completionsMap).sort((a, b) => b.completions - a.completions),
            opened_ranking: Object.values(openedMap).sort((a, b) => (b.not_completed || 0) - (a.not_completed || 0)),
            categories_ranking: Object.values(categoriesMap).sort((a, b) => b.opens - a.opens),
            recent_buyers: payments.sort((a, b) => b.payment_date - a.payment_date).slice(0, 20).map(p => ({
                user_id: p.user_id, checklist_id: p.checklist_id,
                checklist_title: p.checklist_title || p.checklist_id,
                amount: p.amount, date: new Date(p.payment_date).toLocaleString('ru-RU')
            })),
            recent_visitors: Object.values(usersMap).sort((a, b) => (b.last_seen || 0) - (a.last_seen || 0)).slice(0, 15).map(u => ({
                user_id: u.user_id, first_name: u.first_name || '', username: u.username || '',
                visit_count: u.visit_count || 1,
                last_seen_date: u.last_seen ? new Date(u.last_seen).toLocaleString('ru-RU') : '-'
            }))
        }), { headers: corsHeaders });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
}

// Webhook
async function handleWebhook(request, env) {
    try {
        const update = await request.json();

        if (update.pre_checkout_query) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pre_checkout_query_id: update.pre_checkout_query.id, ok: true, error_message: '' })
            });
            return new Response('OK', { status: 200 });
        }

        if (update.message?.successful_payment) {
            const payment = update.message.successful_payment;
            const user_id = update.message.from.id;
            let payload = {};
            try { payload = JSON.parse(payment.invoice_payload); } catch (e) {}

            if (env?.PAYMENTS) {
                await env.PAYMENTS.put(`payment:${payload.checklist_id}:${user_id}`, JSON.stringify({
                    user_id, checklist_id: payload.checklist_id,
                    checklist_title: payload.checklist_title || payload.checklist_id,
                    amount: payment.total_amount, currency: payment.currency,
                    telegram_payment_charge_id: payment.telegram_payment_charge_id,
                    status: 'completed', payment_date: Date.now()
                }));
            }
            return new Response('OK', { status: 200 });
        }

        return new Response('OK', { status: 200 });
    } catch (e) {
        return new Response('Error', { status: 500 });
    }
}
