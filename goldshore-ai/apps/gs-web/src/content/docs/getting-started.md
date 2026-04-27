---
title: "Getting Started"
description: "Get started with GoldShore"
order: 2
---

# Getting Started

Welcome to GoldShore! This guide will help you get up and running with our platform.

## Prerequisites

Before you begin, ensure you have:

- A GoldShore account
- API credentials

## Installation

To install the GoldShore SDK:

```bash
npm install @goldshore/sdk
```

## Configuration

Configure the SDK with your API key:

```javascript
import { GoldShore } from '@goldshore/sdk';

const client = new GoldShore({
  apiKey: 'YOUR_API_KEY'
});
```
