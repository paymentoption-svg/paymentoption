
"use strict";

// ==========================================
// 1. SUPABASE CONNECTION
// ==========================================

const SUPABASE_URL =
    "https://hisoknujnrdvgbgwjwdm.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_qEktVTgKrP5sIzf-HeTMyg_734tagyd";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ==========================================
// 2. GET HTML ELEMENTS
// ==========================================

const paymentSection =
    document.getElementById("paymentSection");

const adminSection =
    document.getElementById("adminSection");

const dashboardSection =
    document.getElementById("dashboardSection");

const paymentForm =
    document.getElementById("paymentForm");

const adminLoginForm =
    document.getElementById("adminLoginForm");

const paymentMessage =
    document.getElementById("message");

const adminMessage =
    document.getElementById("adminMessage");

const recordsMessage =
    document.getElementById("recordsMessage");

const paymentsTable =
    document.getElementById("paymentsTable");

const showPaymentBtn =
    document.getElementById("showPaymentBtn");

const showAdminBtn =
    document.getElementById("showAdminBtn");

const paymentButton =
    document.getElementById("paymentButton");

const loginButton =
    document.getElementById("loginButton");

const logoutButton =
    document.getElementById("logoutButton");

const refreshButton =
    document.getElementById("refreshButton");

const adminWelcome =
    document.getElementById("adminWelcome");


// ==========================================
// 3. CHECK HTML ELEMENTS
// ==========================================

const requiredElements = {
    paymentSection,
    adminSection,
    dashboardSection,
    paymentForm,
    adminLoginForm,
    paymentMessage,
    adminMessage,
    recordsMessage,
    paymentsTable,
    showPaymentBtn,
    showAdminBtn,
    paymentButton,
    loginButton,
    logoutButton
};

for (const [name, element] of Object.entries(requiredElements)) {
    if (!element) {
        console.error("Missing HTML element:", name);
    }
}


// ==========================================
// 4. NAVIGATION BUTTONS
// ==========================================

// CUSTOMER PAYMENT BUTTON

if (showPaymentBtn) {

    showPaymentBtn.addEventListener("click", function () {

        paymentSection.classList.remove("hidden");
        adminSection.classList.add("hidden");
        dashboardSection.classList.add("hidden");

        paymentMessage.innerText = "";
        paymentMessage.className = "";

    });

}


// ADMIN BUTTON

if (showAdminBtn) {

    showAdminBtn.addEventListener("click", function () {

        paymentSection.classList.add("hidden");
        adminSection.classList.remove("hidden");
        dashboardSection.classList.add("hidden");

        adminMessage.innerText = "";
        adminMessage.className = "";

    });

}


// ==========================================
// 5. CUSTOMER M-PESA PAYMENT
// ==========================================

let paymentInProgress = false;

paymentForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    if (paymentInProgress) return;

    const phone =
        document.getElementById("phone").value.trim();

    const amount =
        Number(document.getElementById("amount").value);

    const button = paymentButton;

    // VALIDATE PHONE NUMBER

    if (!/^(07|01)\d{8}$/.test(phone)) {

        paymentMessage.className = "error";

        paymentMessage.innerText =
            "Enter a valid Kenyan phone number.";

        return;
    }

    // VALIDATE AMOUNT

    if (
        !Number.isSafeInteger(amount) ||
        amount < 1 ||
        amount > 150000
    ) {

        paymentMessage.className = "error";

        paymentMessage.innerText =
            "Enter an amount between KSh 1 and KSh 150,000.";

        return;
    }

    paymentInProgress = true;

    button.disabled = true;

    button.innerText = "Sending Prompt...";

    paymentMessage.className = "waiting";

    paymentMessage.innerText =
        "Connecting to M-PESA. Please wait...";

    try {

        // SEND STK PUSH REQUEST

        const { data, error } =
            await supabaseClient.functions.invoke(
                "Mpesa-push",
                {
                    body: {
                        phone: phone,
                        amount: amount
                    }
                }
            );

        if (error) throw error;

        if (!data || !data.success) {

            throw new Error(
                data?.message ||
                "Unable to send payment prompt."
            );
        }

        // GET CHECKOUT REQUEST ID

        const checkoutID =
            data.checkout_request_id;

        if (!checkoutID) {

            throw new Error(
                "Missing M-PESA payment reference."
            );
        }

        // DISPLAY MESSAGE

        paymentMessage.className = "waiting";

        paymentMessage.innerHTML = `
            <strong>M-PESA prompt sent!</strong><br>
            Check your phone ${phone}.<br>
            Enter your M-PESA PIN.<br><br>
            Waiting for payment confirmation...
        `;

        button.innerText = "Waiting for Payment";

        // CHECK PAYMENT STATUS

        let completed = false;

        for (let i = 0; i < 40; i++) {

            await new Promise(resolve =>
                setTimeout(resolve, 3000)
            );

            const {
                data: payment,
                error: checkError
            } = await supabaseClient
                .from("payments")
                .select(
                    "status, mpesa_receipt_number"
                )
                .eq(
                    "checkout_request_id",
                    checkoutID
                )
                .maybeSingle();

            if (checkError) {

                throw new Error(
                    "Could not check payment confirmation. Check your M-PESA messages."
                );
            }

            if (!payment) continue;

            // SUCCESSFUL PAYMENT

            if (payment.status === "Paid") {

                paymentMessage.className = "success";

                paymentMessage.innerHTML = `
                    <strong>✓ PAYMENT SUCCESSFUL!</strong><br>
                    Amount: KSh ${amount.toLocaleString()}<br>
                    Receipt: ${
                        payment.mpesa_receipt_number || "Confirmed"
                    }
                `;

                completed = true;

                break;
            }

            // FAILED PAYMENT

            if (payment.status === "Failed") {

                paymentMessage.className = "error";

                paymentMessage.innerText =
                    "Payment unsuccessful. Please try again.";

                completed = true;

                break;
            }

        }

        // TIMEOUT

        if (!completed) {

            paymentMessage.className = "waiting";

            paymentMessage.innerText =
                "Confirmation is taking longer than expected. " +
                "Check your M-PESA messages before trying again.";

        }

    } catch (error) {

        console.error("Payment error:", error);

        paymentMessage.className = "error";

        paymentMessage.innerText =
            error.message || "Payment request failed.";

    } finally {

        paymentInProgress = false;

        button.disabled = false;

        button.innerText = "Prompt Payment";

    }

});


// ==========================================
// 6. ADMIN EMAIL AND PASSWORD LOGIN
// ==========================================

let loginInProgress = false;

adminLoginForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    if (loginInProgress) return;

    const email =
        document.getElementById("adminEmail")
            .value.trim();

    const password =
        document.getElementById("adminPassword")
            .value;

    const button = loginButton;

    loginInProgress = true;

    button.disabled = true;

    button.innerText = "Logging in...";

    adminMessage.className = "waiting";

    adminMessage.innerText =
        "Verifying administrator details...";

    try {

        // AUTHENTICATE WITH SUPABASE

        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

        if (error) throw error;

        const user = data.user;

        console.log("LOGIN SUCCESSFUL");
        console.log("USER EMAIL:", user.email);
        console.log("APP METADATA:", user.app_metadata);

        // VERIFY ADMIN ROLE

        if (user.app_metadata?.role !== "admin") {

            await supabaseClient.auth.signOut();

            throw new Error(
                "Access denied. This account is not an administrator. Contact your system administrator."
            );
        }

        // OPEN ADMIN DASHBOARD

        paymentSection.classList.add("hidden");

        adminSection.classList.add("hidden");

        dashboardSection.classList.remove("hidden");

        adminWelcome.innerText =
            "Logged in as: " + user.email;

        adminMessage.innerText = "";

        adminMessage.className = "";

        // LOAD PAYMENT RECORDS

        await loadPayments();

    } catch (error) {

        console.error("Admin login error:", error);

        adminMessage.className = "error";

        adminMessage.innerText =
            error.message || "Invalid email or password.";

    } finally {

        loginInProgress = false;

        button.disabled = false;

        button.innerText = "Login to Dashboard";

    }

});


// ==========================================
// 7. LOAD PAYMENT RECORDS
// ==========================================

async function loadPayments() {

    paymentsTable.innerHTML = "";

    recordsMessage.className = "waiting";

    recordsMessage.innerText =
        "Loading payment records...";

    try {

        // VERIFY ADMIN SESSION

        const { data: sessionData, error: sessionError } =
            await supabaseClient.auth.getSession();

        if (sessionError) throw sessionError;

        const user = sessionData.session?.user;

        if (!user || user.app_metadata?.role !== "admin") {

            throw new Error(
                "Administrator login required."
            );
        }

        // FETCH PAYMENT RECORDS

        const { data, error } =
            await supabaseClient
                .from("payments")
                .select(`
                    phone,
                    amount,
                    status,
                    mpesa_receipt_number,
                    created_at
                `)
                .order("created_at", {
                    ascending: false
                });

        if (error) throw error;

        // EMPTY RECORDS

        if (!data || data.length === 0) {

            recordsMessage.className = "";

            recordsMessage.innerText =
                "No payment records found.";

            return;
        }

        recordsMessage.className = "success";

        recordsMessage.innerText =
            "Total payment records: " + data.length;

        // DISPLAY PAYMENT RECORDS

        data.forEach(payment => {

            const row = document.createElement("tr");

            const values = [

                payment.phone ?? "-",

                payment.amount == null
                    ? "-"
                    : "KSh " +
                      Number(payment.amount).toLocaleString(),

                payment.status ?? "-",

                payment.mpesa_receipt_number ?? "-",

                payment.created_at
                    ? new Date(payment.created_at).toLocaleString()
                    : "-"

            ];

            values.forEach((value, index) => {

                const cell = document.createElement("td");

                cell.textContent = value;

                // STATUS COLOURS

                if (index === 2) {

                    if (value === "Paid") {
                        cell.className = "paid";
                    }

                    else if (value === "Failed") {
                        cell.className = "failed";
                    }

                }

                row.appendChild(cell);

            });

            paymentsTable.appendChild(row);

        });

    } catch (error) {

        console.error("Dashboard error:", error);

        recordsMessage.className = "error";

        recordsMessage.innerText =
            error.message || "Could not load payment records.";

    }

}


// ==========================================
// 8. REFRESH PAYMENT RECORDS
// ==========================================

if (refreshButton) {

    refreshButton.addEventListener("click", async function () {

        refreshButton.disabled = true;

        refreshButton.innerText = "Refreshing...";

        try {

            await loadPayments();

        } finally {

            refreshButton.disabled = false;

            refreshButton.innerText = "Refresh Records";

        }

    });

}


// ==========================================
// 9. ADMIN LOGOUT FUNCTION
// ==========================================

async function adminLogout() {

    if (logoutButton) {
        logoutButton.disabled = true;
        logoutButton.innerText = "Logging out...";
    }

    try {

        // SIGN OUT FROM SUPABASE

        const { error } =
            await supabaseClient.auth.signOut();

        if (error) throw error;

        // CLEAR DASHBOARD

        dashboardSection.classList.add("hidden");

        adminSection.classList.remove("hidden");

        paymentSection.classList.add("hidden");

        paymentsTable.innerHTML = "";

        recordsMessage.innerText = "";

        recordsMessage.className = "";

        adminWelcome.innerText = "";

        // RESET LOGIN FORM

        adminLoginForm.reset();

        adminMessage.className = "";

        adminMessage.innerText = "";

        // RESET LOGIN BUTTON

        loginButton.disabled = false;

        loginButton.innerText = "Login to Dashboard";

        console.log("Administrator successfully logged out.");

    } catch (error) {

        console.error("Logout error:", error);

        alert(
            "Could not log out: " + error.message
        );

    } finally {

        if (logoutButton) {
            logoutButton.disabled = false;
            logoutButton.innerText = "Logout";
        }

    }

}


// ==========================================
// 10. CONNECT LOGOUT BUTTON
// ==========================================

if (logoutButton) {

    logoutButton.addEventListener("click", function (event) {

        event.preventDefault();

        adminLogout();

    });

} else {

    console.error(
        "Logout button not found. Check HTML ID: logoutButton"
    );

}


// ==========================================
// 11. AUTOMATIC SESSION CHECK
// ==========================================

async function checkAdminSession() {

    try {

        const { data, error } =
            await supabaseClient.auth.getSession();

        if (error) throw error;

        const user = data.session?.user;

        if (user && user.app_metadata?.role === "admin") {

            paymentSection.classList.add("hidden");

            adminSection.classList.add("hidden");

            dashboardSection.classList.remove("hidden");

            adminWelcome.innerText =
                "Logged in as: " + user.email;

            await loadPayments();

        } else {

            dashboardSection.classList.add("hidden");

            adminSection.classList.add("hidden");

            paymentSection.classList.remove("hidden");

        }

    } catch (error) {

        console.error("Session check error:", error);

    }

}


// ==========================================
// 12. RUN SESSION CHECK
// ==========================================

checkAdminSession();
