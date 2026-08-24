# Publishable DSH Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the plugin as the public npm package `dsh-openrouter-provider-advisor`, installable and auto-mounted with one DSH CLI command.

**Architecture:** Follow the DSH bundle convention used by `dsh-better-sidebar`: public npm metadata points to compiled host/client artifacts, `dsh.bundle.patch` auto-mounts the package, and `prepublishOnly` rebuilds and verifies the package. Runtime-owned DSH modules remain peer dependencies while compile/test versions remain dev dependencies.

**Tech Stack:** npm package metadata, DSH bundle patch, tsdown, TypeScript, Vitest.

## Global Constraints

- Published package name is `dsh-openrouter-provider-advisor`.
- Installation command is `dsh plugin --profile web add dsh-openrouter-provider-advisor@latest`.
- No npm publish or remote repository creation without authenticated user authority.
- Package must contain host/client JS, declarations, bundle patch, plugin manifest, README, and MIT license.

### Task 1: Publish contract

- [ ] Add a failing test for package identity, public access, prepublish build, DSH bundle metadata, artifact list, manifest, and bundle mount name.
- [ ] Update package metadata, loader id, bundle patch, manifest, and license.
- [ ] Run the focused contract test and package dry run.

### Task 2: Consumer documentation and dependency hygiene

- [ ] Move DSH runtime-owned packages to peer dependencies and retain exact development packages needed to build.
- [ ] Add install, update, uninstall, source-install, credential onboarding, and troubleshooting instructions.
- [ ] Add CI validation and a trusted-publishing workflow template that is inert until repository/npm environments are configured.

### Task 3: Clean-profile verification

- [ ] Run tests, typecheck, build, and package dry run.
- [ ] Pack a tarball and install it into a temporary DSH profile or temporary profile fixture.
- [ ] Verify bundle reconciliation and host/client artifact loading without relying on the local link.
