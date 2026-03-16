const stripeCheckoutURL = 'https://buy.stripe.com/fZufZa9KXdX65RJgLK2ZO06';
const thankYouPage = 'thank-you.html';

// Attach event listener to all “Buy SIM Now” buttons
document.querySelectorAll('#buy-sim-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    // Track the click in GA4
    gtag('event', 'buy_click', {
      'event_category': 'SIM Sales',
      'event_label': 'Physical SIM $20'
    });
    // Redirect to Stripe checkout
    window.location.href = stripeCheckoutURL;
  });
});