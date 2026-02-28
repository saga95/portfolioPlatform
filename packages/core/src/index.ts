// @promptdeploy/core — Clean Architecture domain + application layers
// ─── Domain Layer ─────────────────────────────────────────────────────────────
// Entities, value objects, repository interfaces (ports), domain events
//
// ─── Application Layer ────────────────────────────────────────────────────────
// Use cases, DTOs, application services
//
// Dependency rule: domain imports NOTHING external.
//                  application imports ONLY domain.

// Core Package — Domain + Application layers
export * from './domain/index.js';
export * from './application/index.js';;
