# ExpiryGuard V5.1 frontend

- `index.html` - management
- `customer.html` - customer portal

Both use Microsoft authorization code + PKCE. Management authorization and customer Viewer/Admin roles are enforced by the Worker, not by frontend JavaScript.

Customer first sign-in can return `CUSTOMER_ACCESS_PENDING`. The frontend keeps the Microsoft session and explains that management approval is required. After approval, refreshing the page opens the customer's own tenant.
