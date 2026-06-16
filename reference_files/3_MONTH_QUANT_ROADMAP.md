# 3-Month Intensive: From University to Quant Internship/Job

## Executive Summary

You want to land a **quant internship/job** while building ZEX and improving in ML + full-stack + competitive programming. This is **ambitious but achievable in 3 months** if you're disciplined.

**The Strategy:**
- **Month 1:** Foundation (ZEX Phase 1, quant math, CP, ML basics)
- **Month 2:** Depth (ZEX Phases 2-3, advanced quant, system design, ML projects)
- **Month 3:** Polish (ZEX Phases 4-5, portfolio projects, interview prep)

**Hourly Commitment:** 50-60 hours/week (this is a full-time commitment)
- 25-30 hours: ZEX + full-stack coding
- 10-15 hours: Quant + ML learning
- 10-15 hours: Competitive programming + interviews

**Outcome:** You'll have:
- ✅ ZEX MVP (impressive portfolio project)
- ✅ 2-3 deployed full-stack projects
- ✅ Strong quant foundation (probability, statistics, stochastic calculus basics)
- ✅ ML project (recommender system or trading bot)
- ✅ 200+ CP problems solved
- ✅ Interview-ready (system design, algorithms, quant questions)

---

## Part 1: The Reality Check

### What Quant Firms Actually Want

**Tier-1 Quant Firms** (Jane Street, Citadel, Two Sigma, Jump Trading):
- ✓ Strong competitive programming (LC Medium/Hard)
- ✓ Math background (probability, statistics, linear algebra)
- ✓ Systems thinking (how things scale, low-latency design)
- ✓ Portfolio project showing initiative
- ✗ NOT necessarily: tons of ML experience

**What They DON'T Care About:**
- ✗ Fancy tech stack
- ✗ Pretty UI
- ✗ Lots of features
- ✓ **Code quality, optimization, thinking clearly**

**Why ZEX is Perfect:**
- Shows you understand context management (quant-relevant)
- Demonstrates optimization thinking (token budgets, caching)
- Full-stack skills (backend, TUI, API)
- Real product thinking (users, error handling, observability)

---

## Part 2: 3-Month Calendar

### Month 1: Foundation (Weeks 1-4)

#### Week 1: Setup & Kickoff

**Time Budget:**
- ZEX: 20 hours
- Quant Math: 8 hours
- CP: 8 hours
- ML Basics: 4 hours

**ZEX Work:**
- [ ] Day 1-2: Read all ZEX docs (README → Strategic Recommendations)
- [ ] Day 3-4: Implement Phase 1 part 1 (config + intent parser)
- [ ] Day 5-7: Implement Phase 1 part 2 (token counter + TUI skeleton + LLM wrapper)
- [ ] End of week: Have working MVP (user can type, get response from Claude)

**Quant Math Foundation:**
- [ ] Watch: 3Blue1Brown "Essence of Linear Algebra" (2 hours)
- [ ] Watch: StatQuest "Statistics Fundamentals" (3 hours)
- [ ] Read: "A Probability Theory Course" Khan Academy (3 hours)
- [ ] Target: Understand vectors, matrices, basic probability

**Competitive Programming:**
- [ ] LeetCode: Solve 10 Easy problems (focus: array, string, hash map)
- [ ] HackerRank: Warm-up challenges
- [ ] Target: Speed (solve in <15 min)

**ML Basics:**
- [ ] Watch: Fast.ai "Practical Deep Learning for Coders" Lesson 1 (2 hours)
- [ ] Resource: Andrew Ng's ML course (Stanford, free on YouTube)
- [ ] Target: Understand supervised learning, train/test split

**Resources for Week 1:**
```
ZEX:
- Your ZEX_IMPROVED_PROMPT.md docs
- Node.js/TypeScript tutorial (15 min)

Quant:
- 3Blue1Brown YouTube
- Khan Academy Statistics
- "A First Course in Probability" by Sheldon Ross (ref)

CP:
- LeetCode (subscription or free tier)
- HackerRank

ML:
- fast.ai (free)
- Andrew Ng ML course (Coursera, audit free)
```

---

#### Week 2: Acceleration

**Time Budget:**
- ZEX: 20 hours
- Quant: 10 hours
- CP: 10 hours
- ML: 5 hours

**ZEX Work:**
- [ ] Day 1-3: Implement Phase 2 part 1 (SemanticPruner with scoring)
- [ ] Day 4-5: Write tests for pruner
- [ ] Day 6-7: Integrate with Phase 1, verify token savings (40-60%)
- [ ] Target: Working pruner that reduces context

**Quant Math:**
- [ ] Topic: Probability distributions (normal, uniform, exponential)
- [ ] Topic: Conditional probability & Bayes' theorem
- [ ] Practice: Solve 5 quant interview probability problems
- [ ] Resource: "Heard on the Street" (quant Q&A book, first 50 pages)

**Competitive Programming:**
- [ ] LeetCode: 15 Medium problems (focus: DP, sliding window)
- [ ] Contests: 1x Codeforces contest (participate, don't worry about ranking)
- [ ] Target: Understand patterns

**ML:**
- [ ] Project: Train logistic regression classifier on Iris/MNIST
- [ ] Understand: Cross-validation, overfitting, regularization

**New Resources:**
```
Quant:
- "Heard on the Street" PDF (common Q&A)
- Brilliant.org (interactive probability)

CP:
- Codeforces.com (free, contests every week)
- LeetCode patterns (sliding window, DP)

ML:
- Scikit-learn tutorial
- Kaggle datasets
```

---

#### Week 3: Double Down

**Time Budget:**
- ZEX: 20 hours
- Quant: 10 hours
- CP: 12 hours
- ML: 8 hours

**ZEX Work:**
- [ ] Day 1-3: Implement Phase 2 part 2 (GC + memory)
- [ ] Day 4-5: Implement Phase 3 (dual caching)
- [ ] Day 6-7: Write integration tests
- [ ] Target: Context management pipeline working end-to-end

**Quant Math:**
- [ ] Topic: Random walks & martingales
- [ ] Topic: Stochastic processes basics
- [ ] Practice: Solve 10 probability interview questions
- [ ] Reading: "Options, Futures, and Derivatives" Chapter 1-2 (Skipping math, focus on intuition)

**Competitive Programming:**
- [ ] LeetCode: 20 Medium problems (focus: graph, BFS/DFS)
- [ ] Codeforces: 2 contests
- [ ] Target: 50 problems solved total

**ML:**
- [ ] Project: Build neural network for binary classification
- [ ] Understand: Gradient descent, backpropagation
- [ ] Resource: Deep learning from first principles

**Week 3 Checkpoint:**
- ZEX: 80% of context management working
- Quant: Solid probability foundation
- CP: 50 problems solved
- ML: Can train basic neural net

---

#### Week 4: Month 1 Finale

**Time Budget:**
- ZEX: 15 hours
- Quant: 12 hours
- CP: 15 hours
- System Design: 8 hours

**ZEX Work:**
- [ ] Implement Phase 4 (security scanning, ~10 hours)
- [ ] Write docs and README
- [ ] Deploy (even if just locally) and get it working

**Quant Math:**
- [ ] Topic: Correlation & covariance
- [ ] Topic: Time series analysis basics
- [ ] Practice: 15 more quant problems
- [ ] Target: ~100 quant problems solved or reviewed

**Competitive Programming:**
- [ ] LeetCode: 20 Medium problems
- [ ] Codeforces: 2 contests
- [ ] Target: 70 problems solved, consistent performance

**System Design (NEW):**
- [ ] Why: Quant firms ask about scaling, latency, architecture
- [ ] Topic: Cache invalidation (relevant to ZEX!)
- [ ] Topic: Database design
- [ ] Resource: Designing Data-Intensive Applications (Chapter 1-2)

**End of Month 1 Checkpoint:**
```
✓ ZEX: Phase 1-4 working (80% done)
✓ Quant: Solid math foundation
✓ CP: 70 problems solved
✓ ML: Can train & deploy models
✓ System Design: Understand caching, databases
```

---

### Month 2: Depth & Specialization (Weeks 5-8)

#### Week 5: Quant Deep Dive + Systems

**Time Budget:**
- ZEX: 15 hours (finish Phase 5)
- Quant: 15 hours
- CP: 12 hours
- System Design: 8 hours

**ZEX Work:**
- [ ] Day 1-3: Implement Phase 5 (agents, DAG orchestration)
- [ ] Day 4-5: Streaming, slash commands
- [ ] Day 6-7: Polish, write final tests
- [ ] Target: **ZEX MVP complete and working**

**Quant Deep Dive:**
- [ ] Topic: Portfolio theory (Markowitz)
- [ ] Topic: Risk metrics (VaR, Sharpe ratio, Sortino)
- [ ] Topic: Volatility modeling (GARCH basics)
- [ ] Practice: 20 more interview problems
- [ ] Project: Build simple portfolio optimization in Python

**Competitive Programming:**
- [ ] LeetCode: 18 Medium problems (focus: advanced DP, greedy)
- [ ] Codeforces: 2-3 contests
- [ ] Target: 100 problems solved

**System Design:**
- [ ] Topic: Low-latency systems (relevant to quant!)
- [ ] Topic: Distributed caching
- [ ] Reading: Latency numbers every programmer should know
- [ ] Design exercise: Design a stock ticker system

**Resources for Week 5:**
```
Quant:
- "Portfolio Selection" (Markowitz paper, skip math, grasp concept)
- QuantInsti course snippets (free YouTube)

System Design:
- System Design Interview book
- Alex Xu's system design course (free tier)
- "Designing Data-Intensive Applications"

CP:
- LeetCode patterns: DP deep dive
```

---

#### Week 6: ML + Full-Stack Project

**Time Budget:**
- ZEX: 10 hours (final polish)
- Quant: 10 hours
- CP: 15 hours
- ML Project: 15 hours
- Full-Stack: 10 hours

**ZEX:**
- [ ] Final testing and documentation
- [ ] Deploy to GitHub with clean README
- [ ] Record demo video (30 sec - 1 min showing pruner in action)

**Quant:**
- [ ] Topic: Options pricing (Black-Scholes intuition)
- [ ] Topic: Greeks (delta, gamma, vega)
- [ ] Practice: More interview problems
- [ ] Reading: "A Random Walk Down Wall Street" (popular book, intuitive)

**CP:**
- [ ] LeetCode: 20 Medium problems
- [ ] Codeforces: 2 contests
- [ ] Target: 130 problems

**ML Project (Important for Resume):**
- [ ] Project: Stock price prediction with LSTM
  - Data: Historical price data (yfinance)
  - Model: Bidirectional LSTM
  - Deploy: Flask API + basic frontend
  - Goal: Show you can build ML end-to-end

**Full-Stack Project (Quick):**
- [ ] Project: Simple stock screener web app
  - Frontend: React
  - Backend: Node.js / Express
  - Database: PostgreSQL
  - Features: Search stocks, view metrics, save watchlist

**Resources Week 6:**
```
ML:
- Fast.ai NLP course (transfer learning concepts)
- TensorFlow/PyTorch LSTM tutorial

Full-Stack:
- Next.js tutorial (faster than React + Express)
- React + Node bootcamp (Udemy, $15)

CP:
- LeetCode patterns (advanced DP)
```

---

#### Week 7: Interview Prep Sprint

**Time Budget:**
- ZEX: 5 hours (maintenance)
- Quant: 12 hours
- CP: 18 hours
- Interview Prep: 15 hours

**Quant:**
- [ ] Interview mock: 5 quant interview questions (with timing)
- [ ] Reading: "A Practical Guide to Quantitative Finance Interviews" (Xinfeng Zhou)
- [ ] Focus: Martingales, random walks, option pricing

**Competitive Programming:**
- [ ] LeetCode: 25 Medium/Hard problems
- [ ] Target: 155 problems solved
- [ ] Focus: Binary search, advanced graphs, game theory

**Interview Prep:**
- [ ] Topic: System design interview (3 full mocks)
  - Design a distributed cache
  - Design a rate limiter
  - Design a feed ranking system
- [ ] Topic: Behavioral interview (STAR method)
- [ ] Practice: Record yourself explaining ZEX (2 min elevator pitch)
- [ ] Mock interviews: 2-3 with friends or Mock Interview AI

**Resources Week 7:**
```
Quant:
- "A Practical Guide to Quantitative Finance Interviews"
- Jane Street sample problems (public)
- Codility quant challenges

Interview:
- Interviewing.io (free tier)
- Pramp (peer mocking)
- Your own ZEX project (talking points)

CP:
- LeetCode Hard problems
```

---

#### Week 8: Portfolio + Applications

**Time Budget:**
- ZEX: 5 hours (final touches)
- Quant: 8 hours
- CP: 15 hours
- Portfolio Building: 20 hours

**Portfolio Projects:**
- [ ] Project 1: ZEX (main showcase)
- [ ] Project 2: Stock prediction ML model
- [ ] Project 3: Stock screener web app
- [ ] Project 4: Quant algorithms (simple backtest framework)
- [ ] Build 1-2 more projects (see "Project Ideas" below)

**Resume Building:**
- [ ] Polish resume (highlight ZEX, ML project, system design thinking)
- [ ] LinkedIn profile (add projects, endorsements)
- [ ] GitHub (clean repos, good READMEs, stars)

**Applications:**
- [ ] Start applying to internships/entry-level roles
- [ ] Focus: Quant firms, fintech, trading companies
- [ ] Target: Jane Street, Citadel, Two Sigma, Optiver, IMC, Jump, etc.

**End of Month 2:**
```
✓ ZEX: Complete, deployed, demo video
✓ ML: Stock prediction model with API
✓ Full-Stack: Stock screener app
✓ Quant: 200+ problems reviewed, solid foundation
✓ CP: 150+ problems solved
✓ Portfolio: 4-5 projects on GitHub
✓ Applications: Submitted to 10+ firms
```

---

### Month 3: Interview Execution (Weeks 9-12)

#### Week 9-10: Interview Gauntlet

**Time Budget:**
- CP: 20 hours (intense practice)
- Interviews: 15 hours (actual interviews + prep)
- Quant: 10 hours (interview questions)
- System Design: 5 hours (mock interviews)

**Competitive Programming (Final Sprint):**
- [ ] LeetCode: 30 Hard problems
- [ ] Target: 185 problems solved
- [ ] Speed: Solve Medium in <20 min, Hard in <40 min
- [ ] Focus: Problem solving under pressure

**Interview Grind:**
- [ ] Schedule: 5-10 interviews per week
- [ ] Mix: 3 coding interviews, 2 quant interviews, 1 system design, 1 behavioral
- [ ] Prep: 1 hour before each (review similar problems)

**Quant Interview Questions:**
- [ ] Practice: 50 quant questions (cards, dice, probability, puzzles)
- [ ] Timing: 10-15 min per question
- [ ] Focus: Thinking clearly, communicating reasoning

---

#### Week 11: Offers & Negotiations

**Time Budget:**
- Interviews: 10 hours
- Offers: 5 hours
- Follow-ups: 5 hours

**What to Expect:**
- Some interviews will reject you (normal, everyone gets rejected)
- Some will move to next round
- Some will give offers

**Your Competitive Advantages:**
- ✓ ZEX project (shows initiative + systems thinking)
- ✓ ML/full-stack projects (shows versatility)
- ✓ 185+ CP problems (shows thinking ability)
- ✓ Quant math foundation (shows learning ability)

**Offer Evaluation:**
- [ ] Salary (expect: $80-150k for intern/junior)
- [ ] Learning opportunity (quant is all about learning)
- [ ] Team strength (work with smart people)
- [ ] Trading/research opportunities

---

#### Week 12: Decision & Onboarding

- [ ] Choose offer
- [ ] Negotiate if needed
- [ ] Prepare for start date

---

## Part 3: What to Build (Projects for Resume)

### Project 1: ZEX (Main Showcase) ✓
- **Why:** Shows architecture thinking, optimization, full-stack
- **Duration:** 4 weeks (Phase 1 every week, rest distributed)
- **Highlight for quant:** "Context management + token optimization" = resource efficiency
- **GitHub stars target:** 50+ (write good README, demo video)

### Project 2: Stock Price Prediction (ML)
**Specs:**
```python
Model: LSTM/Transformer on historical price data
Dataset: yfinance (free stock data)
Features:
  - Price (OHLC)
  - Volume
  - Technical indicators (SMA, EMA, RSI)
  - Sentiment (optional, NLP)

Output: Predict next 1/5/10 day returns
Metrics: RMSE, MAE, Sharpe ratio

Deployment: Flask API + React frontend
```

**Duration:** 1 week
**GitHub:**
- Clean code, well-documented
- Training script, inference API
- Basic web UI to make predictions
- README with results

**Why Quant Firms Like This:**
- Shows you can build ML end-to-end
- Time series understanding
- Risk metrics (Sharpe ratio)
- Practical deployment thinking

---

### Project 3: Stock Screener Web App
**Specs:**
```
Frontend: React + Tailwind
Backend: Node.js/Express
Database: PostgreSQL
APIs: Alpha Vantage or Finnhub (free tiers)

Features:
  1. Search stocks (ticker, name)
  2. View metrics (P/E, PEG, debt/equity, etc.)
  3. Technical analysis (charts, indicators)
  4. Watchlist (save favorites)
  5. Portfolio tracker (add positions, track returns)

Performance: Fast load times (<2s), caching
```

**Duration:** 1 week
**Why Quant Likes This:**
- Shows full-stack thinking
- UI/UX matters in trading platforms
- Optimization (caching, database design)
- Real user thinking

---

### Project 4: Backtest Framework (Quant)
**Specs:**
```python
Framework for backtesting trading strategies
Features:
  - Load historical data
  - Define trading rules
  - Simulate trades
  - Calculate returns, Sharpe ratio, max drawdown
  - Visualize equity curve

Example strategies:
  - Simple moving average crossover
  - Mean reversion
  - Momentum

Output: Performance metrics, visualization
```

**Duration:** 1 week
**Why Quant Likes This:**
- Shows quantitative thinking
- Risk metrics understanding
- Clean backtesting framework = job-ready code

---

### Project 5: Option Pricing Tool
**Specs:**
```python
Black-Scholes option pricing
Inputs: S (stock price), K (strike), T (time), r (rate), sigma (volatility)
Outputs: Call/put prices, Greeks (delta, gamma, vega, theta)

Features:
  - Interactive calculator
  - Greeks visualization
  - Historical volatility calculation
  - Implied volatility solver

UI: Streamlit app or simple Flask interface
```

**Duration:** 3-4 days
**Why Quant Likes This:**
- Understands options math
- Can implement standard formulas
- Good communication of financial concepts

---

### Project 6: Algorithmic Trading Bot (Optional)
**Specs:**
```python
Connect to paper trading API (Alpaca, Interactive Brokers)
Implement strategy
Manage positions, risk limits
Track performance

Note: Use paper trading, not real money!
```

**Duration:** Skip if time is tight (not critical for landing job)

---

## Part 4: Learning Resources (Complete List)

### Competitive Programming

**Platforms:**
- [ ] **LeetCode** ($30/month, but free tier is enough)
  - Focus: Medium problems on "Top Interview Questions"
  - Target: 200+ problems
  
- [ ] **Codeforces** (free, contests every week)
  - Do rated contests
  - Target: 4 complete contests, improving ranking each time

- [ ] **HackerRank** (free)
  - Good for fundamentals
  - Interview preparation kits

**Problem Topics (in order):**
1. Arrays & strings (20 problems)
2. Hash maps & sets (15 problems)
3. Linked lists (10 problems)
4. Stacks & queues (15 problems)
5. Trees & graphs (30 problems)
6. Sorting & searching (20 problems)
7. Dynamic programming (40 problems)
8. Bit manipulation (10 problems)
9. Math & numbers (15 problems)
10. System design principles (10 problems)

**Study Method:**
```
1. Pick a topic
2. Solve 5 easy problems (10 min each)
3. Solve 3 medium problems (20 min each)
4. Study 1 hard solution (understand, don't memorize)
5. Move to next topic
```

---

### Quantitative Finance

**Free/Affordable Resources:**

1. **YouTube Channels:**
   - [ ] 3Blue1Brown (linear algebra, intuition)
   - [ ] Khan Academy (statistics, probability)
   - [ ] StatQuest (statistics, visual explanations)
   - [ ] QuantInsti (quant-specific concepts)

2. **Books (Read/Skim, Don't Buy All):**
   - [ ] "Heard on the Street" (quant Q&A, $20)
   - [ ] "A Random Walk Down Wall Street" (intuitive, free at library)
   - [ ] "Options, Futures, and Derivatives" Hull (reference, library)
   - [ ] "A Practical Guide to Quantitative Finance Interviews" (XFZhou, $30)
   - [ ] "Designing Data-Intensive Applications" (for system thinking)

3. **Online Courses:**
   - [ ] Andrew Ng's Machine Learning (Coursera, audit free)
   - [ ] MIT OCW Finance (free)
   - [ ] QuantInsti free snippets (YouTube)

4. **Interview Question Sources:**
   - [ ] "Heard on the Street" (book)
   - [ ] Codility quant challenges
   - [ ] Jane Street sample problems (public on their site)
   - [ ] Glassdoor (read what people report)

5. **Math Topics (in order of importance):**
   - [ ] Probability (distributions, conditional probability, Bayes)
   - [ ] Statistics (hypothesis testing, correlation, regression)
   - [ ] Linear Algebra (vectors, matrices, eigenvalues)
   - [ ] Calculus (derivatives, chain rule, optimization)
   - [ ] Stochastic Calculus (Brownian motion, Ito's lemma) - HARD, skip unless time
   - [ ] Time Series (AR, ARMA, GARCH)

**Quant Topics (Interview-Focused):**
- [ ] Random walks & martingales
- [ ] Portfolio theory (mean-variance optimization)
- [ ] Risk metrics (VaR, Sharpe, Sortino)
- [ ] Option pricing (Black-Scholes intuition)
- [ ] Greeks (delta, gamma, vega, theta)
- [ ] Volatility modeling
- [ ] Correlation & covariance
- [ ] Money management & position sizing

---

### Machine Learning

**Courses:**
1. [ ] **Fast.ai** (free, practical-first)
   - Lesson 1: Image classification (foundations)
   - Lesson 2: NLP basics
   - Takes 1-2 weeks if 10 hrs/week

2. [ ] **Andrew Ng's ML Course** (Coursera, audit free)
   - Covers: Supervised learning, unsupervised learning
   - Takes 1 week if 10 hrs/week
   - More theory than fast.ai

3. [ ] **Kaggle Courses** (free, micro-learning)
   - Pandas, scikit-learn, neural networks, etc.
   - 2-3 hours each

**Projects to Build:**
1. [ ] Binary classification (Iris or MNIST)
2. [ ] LSTM for time series (stock prices)
3. [ ] Recommendation system (collaborative filtering)

**Topics:**
- [ ] Supervised learning (regression, classification)
- [ ] Unsupervised learning (clustering, PCA)
- [ ] Neural networks (feedforward, RNN, LSTM)
- [ ] Evaluation (train/test split, cross-validation, metrics)
- [ ] Hyperparameter tuning
- [ ] Overfitting & regularization

---

### Full-Stack Development

**Frontend:**
- [ ] React (18 hours)
  - Components, hooks, state management
  - Routing, forms, API calls

- [ ] Tailwind CSS (2 hours)
  - Utility-first CSS
  - Build fast UIs

**Backend:**
- [ ] Node.js + Express (12 hours)
  - Routes, middleware, error handling
  - REST APIs
  - Authentication (JWT)

- [ ] PostgreSQL (6 hours)
  - Schema design
  - Queries, joins, indexes
  - Migration tools

**DevOps/Deployment:**
- [ ] Docker (3 hours)
- [ ] GitHub Actions (2 hours)
- [ ] Heroku or Vercel (easy deployment, free tier)

**Learning Path (Fastest):**
1. Follow Next.js tutorial (React + Node + deploy) - 2 days
2. Build stock screener - 3 days
3. Deploy to Vercel - 1 day

**Alternative (Shorter):**
- Use no-code platforms (Bubble, Retool) to save time
- But employers like seeing code, so skip this

---

### System Design

**Resources:**
1. [ ] **Designing Data-Intensive Applications** (Book, free at library)
   - Read chapters 1-3 only (16 hours)
   - Teaches: Caching, databases, latency, trade-offs

2. [ ] **System Design Interview** (Book)
   - $30, focuses on interview format
   - Good for practice

3. [ ] **Alex Xu's System Design Course** (free tier on YouTube)
   - Video walkthroughs of designs
   - 4 hours for core concepts

**Topics to Master:**
- [ ] Caching (Redis, strategies)
- [ ] Database design (SQL vs NoSQL, indexing)
- [ ] Load balancing
- [ ] Messaging queues
- [ ] Microservices
- [ ] Latency vs throughput
- [ ] Scalability patterns

**Quant-Relevant Designs:**
- Design a stock ticker system (low latency!)
- Design a rate limiter (relevant to APIs)
- Design a distributed cache (like ZEX!)
- Design a recommendation engine
- Design a feed ranking system

---

## Part 5: Timeline with Milestones

```
MONTH 1: FOUNDATION
Week 1 (Days 1-7):
  Mon-Tue:  Read ZEX docs
  Wed-Fri:  Code ZEX Phase 1
  Sat-Sun:  Start CP, quant math videos

Week 2 (Days 8-14):
  Mon-Tue:  ZEX Phase 2 part 1 (pruner)
  Wed-Fri:  Tests, integrate
  Sat-Sun:  CP contest, quant problems

Week 3 (Days 15-21):
  Mon-Fri:  ZEX Phase 2 part 2 + Phase 3 (GC + cache)
  Sat:      Test everything
  Sun:      Weekly review, 15 CP problems

Week 4 (Days 22-28):
  Mon-Thu:  ZEX Phase 4 (security)
  Fri:      Tests, polish
  Sat-Sun:  CP contest, system design reading

MONTH 1 GOAL: ZEX Phase 1-4 complete, 70 CP problems, quant foundation

─────────────────────────────────────────────────────────────────

MONTH 2: DEPTH & SPECIALIZATION
Week 5 (Days 29-35):
  Mon-Tue:  ZEX Phase 5 (agents)
  Wed-Fri:  Finish ZEX, write README, demo video
  Sat-Sun:  Quant deep dive (portfolio theory), CP (100 problems)

Week 6 (Days 36-42):
  Mon-Wed:  ML project (stock prediction LSTM)
  Thu-Fri:  Full-stack project start (stock screener)
  Sat-Sun:  CP practice (130 problems), interview reading

Week 7 (Days 43-49):
  Mon-Tue:  Finish stock screener, deploy
  Wed-Thu:  Portfolio polish, 2 more projects
  Fri-Sun:  Interview prep sprint, 3 system design mocks

Week 8 (Days 50-56):
  Mon-Fri:  Build 1-2 more projects
  Sat:      Resume polish, LinkedIn
  Sun:      Apply to 10+ companies

MONTH 2 GOAL: 5 projects complete, 155 CP problems, applications sent

─────────────────────────────────────────────────────────────────

MONTH 3: EXECUTION
Weeks 9-10 (Days 57-70):
  Mon-Fri:  Interviews! Expect 5-10 per week
  Sat-Sun:  CP practice, prep for next round

Weeks 11-12 (Days 71-84):
  Mon-Fri:  More interviews, offers come in
  Sat-Sun:  Evaluate offers, negotiate

MONTH 3 GOAL: Land internship/job offer
```

---

## Part 6: Daily Schedule (50-60 hrs/week)

### Weekday Schedule (Monday-Friday)
```
08:00 - 08:30  Warm-up: 3 easy CP problems (speed run)
08:30 - 09:00  Review: Yesterday's material
09:00 - 12:00  Deep work: ZEX coding or projects (3 hours)
12:00 - 13:00  Lunch
13:00 - 15:00  Learning: Quant/ML/System Design course (2 hours)
15:00 - 16:00  Practice: 2 medium CP problems
16:00 - 17:00  Projects: ML or full-stack (not ZEX)
17:00 - 17:30  Break, stretch
17:30 - 19:00  Deep work: Continue morning project (1.5 hours)
19:00 - 20:00  Dinner
20:00 - 21:00  Interview prep or quant problems (1 hour)
21:00 - 21:30  Review, plan next day
```

**Total:** 10.5 hours/day × 5 days = 52.5 hours

### Weekend Schedule (Saturday-Sunday)
```
09:00 - 10:00  CP contest or practice (2-3 problems)
10:00 - 11:00  Quant interview problems (5-10 problems)
11:00 - 13:00  Build projects or code (2 hours)
13:00 - 14:00  Lunch
14:00 - 16:00  Learning: New topic or deep dive (2 hours)
16:00 - 17:00  Portfolio maintenance (update GitHub, README)
17:00 - 18:00  Mock interview or system design
18:00 - 20:00  Relax, exercise, social
20:00 - 21:00  Review week, plan next week
```

**Total:** 7 hours/day × 2 days = 14 hours

**Weekly Total:** 52.5 + 14 = 66.5 hours (adjust to 50-60 as needed)

---

## Part 7: Success Metrics & Tracking

### Competitive Programming
```
Goal: 200+ problems solved, Medium proficiency

Tracking:
  Week 1: 10 problems (easy)
  Week 2: 30 total (15 easy, 15 medium)
  Week 3: 50 total (20 easy, 25 medium, 5 hard)
  Week 4: 70 total
  Week 5: 100 total
  Week 8: 155 total
  Week 12: 200 total

Milestones:
  □ Solve 5 consecutive medium problems in <60 min
  □ Solve 1 hard problem in <40 min
  □ Complete 2 Codeforces contests with +100 rating
```

### ZEX Project
```
Goal: Working MVP with great documentation

Checklist:
  □ Phase 1: Working TUI, config, parser, token counter, LLM client
  □ Phase 2: Pruner with 40-60% token savings verified
  □ Phase 3: Dual caching with 20-30% hit rate
  □ Phase 4: Security scanner with <2% false positives
  □ Phase 5: Agents, DAG execution, streaming
  □ Deployment: GitHub with stars, demo video
  □ Documentation: Clear README, architecture docs
  □ Code quality: 80%+ test coverage
```

### Quant Foundation
```
Goal: Solve 200+ problems, understand key concepts

Topics:
  □ Probability (Bayes, distributions, random walks)
  □ Statistics (regression, correlation, hypothesis testing)
  □ Portfolio theory (Markowitz, sharpe ratio)
  □ Options (Black-Scholes, Greeks)
  □ Risk metrics (VaR, drawdown)

Milestones:
  □ Solve 50 problems (week 2)
  □ Solve 100 problems (week 4)
  □ Solve 150 problems (week 6)
  □ Solve 200+ problems (week 8)
  □ Explain 10 concepts to a friend without notes
```

### Projects & Portfolio
```
Goal: 5+ deployed projects on GitHub

Projects:
  □ ZEX (main showcase)
  □ Stock prediction LSTM
  □ Stock screener web app
  □ Backtesting framework
  □ Option pricing tool
  □ (Optional) Trading bot or other

Metrics:
  □ Each project: >100 lines of code
  □ Each project: Clear README with examples
  □ Each project: Tests or demo
  □ GitHub: 50+ stars total
  □ GitHub: Consistent commit history
```

### Interviews
```
Goal: Land internship/job at Tier-1 quant firm

Metrics:
  □ Apply to 20+ companies
  □ Get 10+ interviews
  □ Pass 3+ rounds
  □ Receive offer(s)
  □ Negotiate and accept

Interview Preparation:
  □ 5+ system design mocks
  □ 5+ coding interview mocks
  □ 5+ quant interview mocks
  □ Record elevator pitch about ZEX (2 min)
  □ Prepare STAR stories (3 projects, challenges overcome)
```

---

## Part 8: Quick Reference - What to Learn When

### Month 1 (Foundation)
```
CP:       Easy → Medium (50 problems)
Quant:    Probability, basic statistics (Khan Academy)
ML:       Basics, supervised learning
FS:       Skip for now
System:   Skip for now
ZEX:      Phases 1-4
```

### Month 2 (Depth)
```
CP:       Medium → Hard (155 problems)
Quant:    Portfolio theory, risk metrics, options (200 problems)
ML:       LSTM, time series, deploy model
FS:       React + Node full stack (stock screener)
System:   Caching, databases, latency (20 hrs)
ZEX:      Phase 5 + polish
```

### Month 3 (Polish & Execute)
```
CP:       Medium/Hard drills (200 problems)
Quant:    Interview questions, mock interviews
ML:       (maintenance only)
FS:       (maintenance only)
System:   Mock interviews, design exercises
ZEX:      (maintenance, showcase)
Interviews: THE FOCUS
```

---

## Part 9: What Quant Firms Actually Ask (Interview Questions)

### Coding Interviews

**Easy (30 min):**
```
1. Reverse a linked list
2. Two sum (find pair with target sum)
3. Merge sorted arrays
4. Palindrome check
```

**Medium (45 min):**
```
1. LCA in binary tree
2. Longest substring without repeating chars
3. Median of two sorted arrays
4. Word ladder (BFS)
5. Coin change (DP)
```

**Hard (60 min):**
```
1. Trapping rain water
2. N-queens
3. Skyline problem
4. Concatenated words
5. Regular expression matching
```

**Quant-Specific Coding:**
```
1. Implement Black-Scholes formula
2. Calculate Greeks
3. Backtest a simple strategy
4. Simulate random walk
5. Calculate Value at Risk (VaR)
```

---

### Quant Interview Questions

**Easy (15 min):**
```
1. Fair coin, expected flips until 2 heads?
2. Die roll, probability of sum = 10?
3. What is a martingale?
4. Explain Sharpe ratio
5. Normal distribution: 68-95-99.7 rule?
```

**Medium (20 min):**
```
1. Two players flip coins, first heads wins. Fair odds?
2. Expected value of stock price after N steps?
3. What's the Greeks: delta, gamma, vega, theta?
4. How to calculate implied volatility?
5. Kelly criterion for position sizing?
6. Correlation vs causation, give examples
7. How to model volatility?
```

**Hard (30 min):**
```
1. Value an American option
2. Explain stochastic calculus intuition
3. Portfolio optimization (mean-variance)
4. VaR calculation methods
5. Brownian motion: is it predictable?
6. Monte Carlo simulation for option pricing
7. Strategies to hedge risk
```

**Brain Teasers (10-20 min):**
```
1. A rope on a cylinder, wrap it. Can you have infinite surface area?
2. How many piano tuners in Chicago? (Fermi estimation)
3. Birthday paradox: how many people for 50% match?
4. Monty Hall problem
5. Expected value of auction bids
```

---

### System Design Interviews

**Easy (30 min):**
```
1. Design a simple cache (LRU cache)
2. Design a rate limiter
3. Design a URL shortener
```

**Medium (45 min):**
```
1. Design a distributed cache
2. Design a stock ticker system (real-time updates)
3. Design a recommendation system
4. Design a search autocomplete system
```

**Hard (60 min):**
```
1. Design a trading platform (scalable, low-latency)
2. Design a messaging system
3. Design a database (replication, sharding)
```

**Quant-Specific System Design:**
```
1. Design a low-latency order matching engine
2. Design a risk management system
3. Design a backtesting framework
4. Design a market data processing system
```

---

## Part 10: Red Flags & How to Avoid Them

### Red Flags Interviewers Notice

❌ **Weak Projects:**
- GitHub repo with no README
- Code that doesn't run
- Copied code from tutorials
- No clear structure or tests

✅ **How to Fix:**
- Write great READMEs (explain what, why, how)
- Ensure code runs out-of-the-box
- Add personal touches, modifications
- Include tests or demos

---

❌ **Weak CP Foundation:**
- Can't solve 2x LeetCode Medium problems in 45 min
- No understanding of why solution works
- Can't optimize after first pass
- No knowledge of edge cases

✅ **How to Fix:**
- Practice on LeetCode daily (30 min)
- Understand patterns, not just memorize solutions
- Always optimize: time complexity, space complexity
- Think about edge cases before coding

---

❌ **Weak Quant Knowledge:**
- Can't explain basic concepts (probability, sharpe ratio, vega)
- Memorized formulas without understanding
- Can't do simple probability math in head
- No intuition for risk/return trade-offs

✅ **How to Fix:**
- Learn intuition first, formulas second
- Explain concepts to friends without notes
- Solve problems by hand (no calculator)
- Practice interview questions repeatedly

---

❌ **ZEX Project Issues:**
- Copied from tutorial without understanding
- Can't explain architecture decisions
- No demo or documentation
- Doesn't actually work

✅ **How to Fix:**
- Build it from the docs provided (not a tutorial)
- Write docs explaining YOUR decisions
- Record 1-min demo showing it in action
- Test thoroughly before showcasing

---

## Part 11: Negotiation & Offer Evaluation

### Offer Evaluation Criteria

When you get offers, evaluate on:

**1. Learning Value (Most Important for Internship)**
- Will you learn from smart people?
- Will you touch real trading code?
- Will you understand the business?

**2. Compensation**
- Internship: $15-25/hour typical, some pay $30+/hr
- Entry-level: $80-150k salary typical
- Look for: signing bonus, housing stipend

**3. Career Growth**
- Do alumni get hired full-time?
- Do interns work on meaningful projects?
- What's the mentorship like?

**4. Team & Culture**
- Smart people you want to work with?
- Fast-paced, learning-focused?
- Good work-life balance?

### Negotiation Tips

✅ **Do:**
- Ask for more money (always, politely)
- Ask what success looks like
- Get offer in writing before accepting
- Ask about signing bonus, bonuses

❌ **Don't:**
- Play multiple offers against each other (looks bad)
- Demand unreasonable amounts
- Accept without reading contract
- Immediately say yes (wait 24-48 hours)

---

## Part 12: Mental Health & Sustainability

### Burnout Prevention

**50-60 hours/week is intense. Avoid burnout:**

✅ **Do:**
- Take 1 full day off per week (Saturday evening or Sunday)
- Exercise 30 min daily (running, gym, walk)
- Sleep 7-8 hours (non-negotiable)
- Eat healthy (meal prep on Sunday)
- Meditate 10 min/day (reduces stress)
- Social: 2-3 hours/week with friends
- Review weekly (what worked? what didn't?)

❌ **Don't:**
- Work 24/7 (unsustainable)
- Skip sleep (kills productivity & health)
- Neglect relationships (you need people)
- Compare yourself to others (different paths)
- Be perfectionist (good is enough for most)

### Weekly Review (Sunday 30 min)

```
1. What went well?
2. What was hard?
3. What will I improve next week?
4. Metrics: CP problems, quant problems, code written
5. Adjust next week's plan if needed
```

### The 80/20 Rule

Focus on 20% of effort that gives 80% of results:

```
CP: 20% of problems are 80% of interview questions
Quant: 20% of concepts are 80% of interview Qs
ZEX: 20% of features give 80% of value
```

**Don't perfect everything. Get to "good enough" and move on.**

---

## Part 13: Success Stories & Inspiration

### What Successful Candidates Do

**Candidate A: Jane Street Intern**
- Competitive programmer (1200 rating on Codeforces)
- Math competition background
- 2-3 projects on GitHub
- Strong probability intuition
- Solved 150+ LeetCode problems
- Result: Offer from Jane Street

**Candidate B: Two Sigma Junior**
- ML background (NLP papers, Kaggle)
- Strong Python, systems thinking
- 1 deployed full-stack project
- 100+ LeetCode problems
- Good quant fundamentals
- Result: Offer from Two Sigma

**Candidate C: Citadel Summer**
- Pure quant math focus
- Limited coding (but solid)
- Strong probability knowledge
- Solved 200+ interview questions
- Portfolio theory background
- Result: Offer from Citadel

**Common Themes:**
✓ Strong fundamentals (CP, math, or both)
✓ 1-3 good projects showing thinking
✓ Clear communication
✓ Curiosity and learning mindset
✓ Persistence (most got rejected first)

---

## Part 14: Final Checklist

### Before Month 1 Starts
- [ ] Read all ZEX docs
- [ ] Set up dev environment (Node, Python, PostgreSQL)
- [ ] Create GitHub account, set up repo for ZEX
- [ ] Sign up for LeetCode, Codeforces, Kaggle
- [ ] Set up daily schedule calendar
- [ ] Get accountability buddy (study together)

### End of Month 1
- [ ] ZEX Phases 1-4 complete
- [ ] 70 CP problems solved
- [ ] 100+ quant problems reviewed
- [ ] Quant math foundation solid
- [ ] On track for schedule

### End of Month 2
- [ ] ZEX complete + deployed
- [ ] ML project complete (stock prediction)
- [ ] Full-stack project complete (stock screener)
- [ ] 155 CP problems solved
- [ ] 2-3 more portfolio projects
- [ ] Applications sent to 10+ companies
- [ ] 3+ system design mocks done

### End of Month 3
- [ ] 10+ interviews completed
- [ ] 200+ CP problems solved
- [ ] Offers received and negotiated
- [ ] Internship/job accepted

---

## Summary & Action Items

### Right Now (Today)
1. [ ] Read this entire document
2. [ ] Setup dev environment
3. [ ] Join LeetCode, Codeforces, Kaggle
4. [ ] Create GitHub account
5. [ ] Set up calendar with daily schedule

### This Week
1. [ ] Read ZEX docs
2. [ ] Start ZEX Phase 1
3. [ ] Solve 10 easy CP problems
4. [ ] Watch 3Blue1Brown linear algebra (3 hours)
5. [ ] Understand basic probability

### This Month
1. [ ] Complete ZEX Phase 1
2. [ ] Solve 70 CP problems
3. [ ] Build quant math foundation
4. [ ] Get first project on GitHub

### By End of Month 2
1. [ ] 5+ projects on GitHub (ZEX, ML, FS, quant, etc.)
2. [ ] 155+ CP problems solved
3. [ ] Applications sent
4. [ ] Interview invitations coming in

### By End of Month 3
1. [ ] Internship/job offer accepted
2. [ ] 200+ CP problems solved
3. [ ] Strong quant, ML, FS foundation
4. [ ] Ready to start and learn on the job

---

## Resources Quick Links

```
Competitive Programming:
- LeetCode: leetcode.com
- Codeforces: codeforces.com
- HackerRank: hackerrank.com

Quant Learning:
- 3Blue1Brown: youtube.com/@3blue1brown
- Khan Academy: khanacademy.org
- MIT OCW: ocw.mit.edu

Machine Learning:
- fast.ai: fast.ai
- Andrew Ng: coursera.org/learn/machine-learning
- Kaggle: kaggle.com

Full-Stack:
- Next.js: nextjs.org/learn
- Udemy: React + Node bootcamps ($15)
- Tailwind: tailwindcss.com

System Design:
- "Designing Data-Intensive Applications" (library)
- Alex Xu YouTube: youtube.com/@systemdesigninterview
- Interviewing.io: interviewing.io

ZEX:
- Your documents in /outputs folder
```

---

## Final Thoughts

This is an **ambitious plan for 3 months**. It's designed for someone in their final year of university with:
- ✅ Strong fundamentals (math, CS)
- ✅ Willing to work 50-60 hrs/week
- ✅ Hungry to learn and compete
- ✅ Good at time management

**You have all the tools:**
- ✅ ZEX specification (unique portfolio project)
- ✅ Learning resources (curated list)
- ✅ Interview questions (realistic)
- ✅ Timeline (achievable)
- ✅ Projects (clearly defined)

**The difference between success and failure is execution.** Focus on:
1. **Consistency** (small daily progress)
2. **Quality** (write good code, understand concepts)
3. **Reflection** (weekly review, adjust)
4. **Health** (sleep, exercise, mental health)

Good luck. You've got this. 🚀

**Start today. No excuses.**
