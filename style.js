
// ==========================================
// NAVIGATION BUTTONS
// ==========================================

document.getElementById("showPaymentBtn")
.addEventListener("click", function() {

    document.getElementById("paymentSection")
        .classList.remove("hidden");

    document.getElementById("adminSection")
        .classList.add("hidden");

    document.getElementById("dashboardSection")
        .classList.add("hidden");

});


document.getElementById("showAdminBtn")
.addEventListener("click", function() {

    document.getElementById("paymentSection")
        .classList.add("hidden");

    document.getElementById("adminSection")
        .classList.remove("hidden");

    document.getElementById("dashboardSection")
        .classList.add("hidden");

});


// LOGOUT AND REFRESH BUTTONS

document.getElementById("logoutButton")
.addEventListener("click", adminLogout);

document.getElementById("refreshButton")
.addEventListener("click", loadPayments);
