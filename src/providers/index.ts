// src/providers/index.ts
import { ProviderRegistry } from '../core/providers/ProviderRegistry';
import { hermesProviderRegistration } from './hermes/registration';

// Register all providers
ProviderRegistry.register('hermes', hermesProviderRegistration);

export { hermesProviderRegistration } from './hermes/registration';