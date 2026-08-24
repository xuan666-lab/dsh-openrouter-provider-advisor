# Provider panel polish design

The panel is improved in four independently reviewable stages: interaction feedback and safe state retention; explainable ranking; denser information hierarchy with explicit cache pricing; and lightweight decision aids. Each stage remains bilingual, preserves DSH-native credential handling, and receives its own test-backed commit.

Refresh failures retain the last successful data. Provider switching stays visible long enough to show progress and success, while failures leave the previous provider selected. Ranking explanations derive only from existing endpoint scores. Layout changes remain responsive inside the existing modal. Product aids are local UI preferences and estimates, never automatic provider mutations.
