# Authorize server use cases by capability

Backend authorization will use centralized, deny-by-default capabilities rather than scattering raw role comparisons across routes and services. Organization membership and Platform Administrator status resolve capabilities, but each server use case enforces its own required capability so UI visibility and route authentication never become the authorization boundary.
