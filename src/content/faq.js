// Frequently asked questions per calculator id — rendered under "How it works" and emitted as
// FAQPage JSON-LD by scripts/build.mjs. Answers are short HTML fragments (inline tags only).
// Calculators without an entry simply get no FAQ block, so new ids never break the build.
// Keep legal/tax figures out of here where possible (they live in each calculator's about text,
// which cites the official source and fiscal year) so the two can never disagree.

const FAQ = {
  // ───────────── Financial ─────────────
  mortgage: [
    { q: 'What is included in a monthly mortgage payment?', a: 'Lenders often call it <b>PITI</b>: principal and interest on the loan, plus property tax and homeowners insurance paid through escrow. If your down payment is under 20% you may also pay private mortgage insurance (PMI), and condos or planned communities add HOA dues.' },
    { q: 'How is the principal and interest part calculated?', a: 'It uses the standard amortization formula M = P × r(1+r)<sup>n</sup> ÷ ((1+r)<sup>n</sup> − 1), where P is the loan amount, r the monthly rate (annual rate ÷ 12) and n the number of monthly payments. Early payments are mostly interest; later ones are mostly principal.' },
    { q: 'How much do extra payments save?', a: 'Every extra amount goes straight to principal, so it stops interest from accruing on that money for the rest of the loan. Even a small extra monthly payment can cut years off a 30-year mortgage — enter one in the calculator to see the exact interest saved and the new payoff date.' },
    { q: 'When can I stop paying PMI?', a: 'On conventional U.S. loans you can ask to cancel PMI once the balance reaches 80% of the original home value, and it ends automatically at 78% under the Homeowners Protection Act. FHA mortgage insurance follows different rules.' },
  ],
  loan: [
    { q: 'How is a fixed-rate loan payment calculated?', a: 'The payment is the amount that repays the principal plus interest in equal instalments: PMT = P × r ÷ (1 − (1+r)<sup>−n</sup>), with r the periodic interest rate and n the number of payments.' },
    { q: 'What is the difference between interest rate and APR?', a: 'The interest rate is the cost of borrowing the principal. The APR also spreads upfront fees (origination, points) over the term, so it is the better number for comparing offers from different lenders.' },
    { q: 'Does the compounding frequency matter?', a: 'Yes. The same nominal rate compounded more often costs slightly more. The calculator converts any compounding (daily, monthly, annually…) to an equivalent rate per payment period, so results stay correct.' },
    { q: 'Is it better to choose a shorter loan term?', a: 'A shorter term means a higher payment but far less total interest. If the higher payment is comfortable, it usually saves money; otherwise take the longer term and make extra payments when you can.' },
  ],
  emi: [
    { q: 'What is the EMI formula?', a: 'EMI = P × r × (1+r)<sup>n</sup> ÷ ((1+r)<sup>n</sup> − 1), where P is the loan amount, r is the monthly interest rate (annual rate ÷ 12 ÷ 100) and n is the tenure in months.' },
    { q: 'Does EMI change during the loan?', a: 'On a fixed-rate loan the EMI stays the same; only the split between interest and principal changes each month. On a floating-rate loan the bank may change the EMI or the tenure when the rate changes.' },
    { q: 'How can I reduce my EMI?', a: 'Choose a longer tenure, make a larger down payment, negotiate a lower rate, or make part-prepayments and ask the bank to re-calculate the EMI. A longer tenure lowers the EMI but increases the total interest you pay.' },
    { q: 'Are processing fees included in the EMI?', a: 'No. Processing fees, insurance and other charges are usually paid upfront or deducted from the disbursed amount, so add them separately when comparing the true cost of loans.' },
  ],
  'auto-loan': [
    { q: 'Is sales tax included in the car loan?', a: 'In most U.S. states sales tax and fees can be rolled into the loan, which is what the calculator assumes when you include them. Many states tax only the price after the trade-in value is deducted.' },
    { q: 'What happens if I still owe money on my trade-in?', a: 'Negative equity (owing more than the trade-in is worth) is added to the new loan. That raises your payment and total interest, so it is worth paying it down first if possible.' },
    { q: 'What is a good loan term for a car?', a: 'Shorter terms (36–60 months) keep total interest low and reduce the risk of owing more than the car is worth. 72- and 84-month loans lower the payment but cost much more overall.' },
  ],
  'compound-interest': [
    { q: 'What is the compound interest formula?', a: 'A = P(1 + r/n)<sup>nt</sup>, where P is the starting amount, r the annual rate, n the compounding periods per year and t the years. Regular contributions are added as the future value of an annuity.' },
    { q: 'How often should interest compound?', a: 'More frequent compounding earns slightly more: at 5% a year, monthly compounding gives an effective 5.12% and daily about 5.13%. The difference is small compared with the rate itself and how long you stay invested.' },
    { q: 'What is the Rule of 72?', a: 'Divide 72 by the annual interest rate to estimate how many years money takes to double. At 8% it doubles in about 9 years. It is an approximation that works best for rates between 6% and 10%.' },
    { q: 'Does the calculator account for inflation or tax?', a: 'No — results are nominal and pre-tax. Use the Inflation Calculator to see the future value in today\'s money, and remember that interest in a taxable account is usually taxed every year.' },
  ],
  'simple-interest': [
    { q: 'What is the simple interest formula?', a: 'Interest = P × r × t, where P is the principal, r is the annual rate as a decimal and t is the time in years. The total amount is P + interest.' },
    { q: 'How is simple interest different from compound interest?', a: 'Simple interest is earned only on the original principal. Compound interest is also earned on previously added interest, so it grows faster over time.' },
    { q: 'Where is simple interest used?', a: 'Many car loans, short-term personal loans, some bonds and savings certificates that pay out profit periodically use simple interest, because interest is paid out rather than added to the balance.' },
  ],
  retirement: [
    { q: 'How much do I need to retire?', a: 'A common guideline is 25 times your expected yearly spending (the inverse of the 4% rule). Your real number depends on pensions, social security, health costs and how long you expect retirement to last.' },
    { q: 'What is the 4% rule?', a: 'It suggests withdrawing 4% of your savings in the first year of retirement and adjusting that amount for inflation each year. Historical U.S. data showed this lasting about 30 years in most periods, but it is not a guarantee.' },
    { q: 'Why does the calculator show income in today\'s money?', a: 'Because a future amount means little without inflation. Showing results in today\'s purchasing power lets you compare the projected income directly with what you spend now.' },
    { q: 'What return should I assume?', a: 'Use a conservative, after-fee figure. Many planners use 5–7% nominal for a stock-heavy portfolio and less as you move to bonds. Try several rates to see how sensitive your plan is.' },
  ],
  'savings-goal': [
    { q: 'How is the monthly saving amount worked out?', a: 'It solves the future-value-of-an-annuity formula for the payment: PMT = (Goal − P(1+r)<sup>n</sup>) × r ÷ ((1+r)<sup>n</sup> − 1), where P is what you already have, r the monthly return and n the number of months.' },
    { q: 'What if my savings earn no interest?', a: 'Then the answer is simply (goal − current savings) ÷ number of months. The calculator handles a 0% rate correctly.' },
    { q: 'How can I reach my goal sooner?', a: 'Increase the monthly amount, start with a larger lump sum, or find a higher-yielding (but appropriately safe) account. For short-term goals, safety matters more than return.' },
  ],
  roi: [
    { q: 'How is ROI calculated?', a: 'ROI = (final value − amount invested) ÷ amount invested × 100%. It tells you the total gain or loss as a percentage of what you put in.' },
    { q: 'What is the difference between ROI and annualized return?', a: 'ROI ignores time. Annualized return (CAGR) = (final ÷ initial)<sup>1/years</sup> − 1 converts it to a yearly rate, so a 50% gain over 2 years can be compared fairly with a 50% gain over 10 years.' },
    { q: 'What counts as a good ROI?', a: 'It depends on risk and time. Broad stock markets have historically returned around 7–10% a year before inflation; a safer investment with a lower return can still be the better choice.' },
  ],
  inflation: [
    { q: 'How does the inflation calculation work?', a: 'Future cost = today\'s cost × (1 + inflation rate)<sup>years</sup>. Purchasing power works the other way: today\'s money ÷ (1 + rate)<sup>years</sup>.' },
    { q: 'What inflation rate should I use?', a: 'Many central banks, including the U.S. Federal Reserve, target about 2% a year. For your own country, use the recent consumer price index (CPI) figure from the national statistics office.' },
    { q: 'Why does inflation matter for savings?', a: 'If your savings earn less than inflation, their real value falls even though the balance grows. Compare your after-tax interest rate with inflation to see your real return.' },
  ],
  salary: [
    { q: 'How do you convert an hourly wage to a yearly salary?', a: 'Multiply the hourly rate by hours per week and by weeks worked per year. With 40 hours and 52 weeks that is hourly × 2,080.' },
    { q: 'Is the result before or after tax?', a: 'Before tax. Take-home pay depends on income tax, social security and other deductions in your country.' },
    { q: 'Should I include holidays and vacation?', a: 'If you are paid for holidays, keep 52 weeks. If you are a contractor and unpaid for time off, reduce the weeks per year to get a realistic annual figure.' },
  ],
  discount: [
    { q: 'How do I calculate a discount?', a: 'Sale price = original price × (1 − discount ÷ 100). A 25% discount on 80 is 80 × 0.75 = 60, so you save 20.' },
    { q: 'Are two discounts the same as adding them together?', a: 'No. 20% off followed by another 10% off is 1 − 0.8 × 0.9 = 28% off, not 30%, because the second discount applies to the already-reduced price.' },
    { q: 'Is tax charged before or after the discount?', a: 'Usually after: sales tax or VAT is applied to the discounted price, which is how the calculator works.' },
  ],
  tip: [
    { q: 'How much should I tip?', a: 'Customs vary by country. In the U.S., 15–20% at sit-down restaurants is typical; in much of Europe and Asia a service charge may already be included or a small round-up is enough.' },
    { q: 'Should I tip on the amount before or after tax?', a: 'Etiquette guides generally suggest tipping on the pre-tax amount, but many people tip on the total for simplicity. The difference is small.' },
    { q: 'How is the bill split?', a: 'The calculator adds the tip to the bill and divides the total equally by the number of people, showing each person\'s share of the tip and the total.' },
  ],
  vat: [
    { q: 'How do I add VAT to a price?', a: 'Gross price = net price × (1 + VAT rate ÷ 100). At 20% VAT, 100 becomes 120.' },
    { q: 'How do I remove VAT from a price?', a: 'Divide, don\'t subtract: net = gross ÷ (1 + rate ÷ 100). At 20%, 120 ÷ 1.2 = 100. Taking 20% off 120 would give 96, which is wrong.' },
    { q: 'Does this work for U.S. sales tax and GST?', a: 'Yes. Sales tax, GST and VAT are all percentage taxes on the price, so the same maths applies — just enter your local rate.' },
  ],
  'credit-card': [
    { q: 'How is credit card interest calculated?', a: 'Most cards charge the APR divided into a daily or monthly rate on your balance. The calculator uses APR ÷ 12 per month, which closely matches statements when the balance is not changing much.' },
    { q: 'Why does paying only the minimum take so long?', a: 'Minimum payments are a small percentage of the balance, so most of each payment goes to interest. Paying a fixed amount above the minimum shortens the payoff dramatically.' },
    { q: 'Should I pay off the highest-rate card first?', a: 'Mathematically, the avalanche method (highest APR first) saves the most interest. The snowball method (smallest balance first) can help motivation. A 0% balance transfer may also help if the fee is low.' },
  ],
  'profit-margin': [
    { q: 'What is the difference between margin and markup?', a: 'Margin is profit as a percentage of the selling price; markup is profit as a percentage of cost. Buying at 60 and selling at 100 is a 40% margin but a 66.7% markup.' },
    { q: 'How do I find the price for a target margin?', a: 'Price = cost ÷ (1 − margin). For a 40% margin on a cost of 60: 60 ÷ 0.6 = 100.' },
    { q: 'Is this gross or net margin?', a: 'Gross margin — it uses the cost of the item only. Net margin also subtracts overheads such as rent, salaries and taxes.' },
  ],
  'break-even': [
    { q: 'What is the break-even formula?', a: 'Break-even units = fixed costs ÷ (price per unit − variable cost per unit). The denominator is the contribution margin each sale makes towards fixed costs.' },
    { q: 'What are fixed and variable costs?', a: 'Fixed costs (rent, salaries, insurance) stay the same regardless of volume. Variable costs (materials, packaging, shipping, commissions) rise with each unit sold.' },
    { q: 'How can I lower my break-even point?', a: 'Raise your price, cut variable costs per unit, or reduce fixed costs. Small improvements in contribution margin often have the biggest effect.' },
  ],
  zakat: [
    { q: 'What is the Nisab?', a: 'Nisab is the minimum net wealth on which Zakat is due: the value of 87.48 g of gold or 612.36 g of silver. Many scholars recommend the silver Nisab because it is lower and benefits more recipients; check with your local scholar.' },
    { q: 'What assets are zakatable?', a: 'Cash and bank balances, gold and silver, business stock, shares and investments held for trade, and money owed to you that you expect to receive. Your home, car and personal items are generally exempt.' },
    { q: 'How is Zakat calculated?', a: 'Subtract debts due now from your zakatable assets. If the result is at or above the Nisab and you have held it for one lunar year (hawl), Zakat is 2.5% of the net amount.' },
    { q: 'Is Zakat due on jewellery?', a: 'Scholars differ: many (including the Hanafi school) say gold and silver jewellery is zakatable, while others exempt jewellery that is worn regularly. Enter in the gold and silver fields only the value you consider zakatable.' },
  ],
  investment: [
    { q: 'How does the investment projection work?', a: 'Your starting amount grows at the expected return, compounding each period, and each regular contribution is added and grows from the date it is invested. The chart shows contributions versus growth year by year.' },
    { q: 'Should I contribute at the start or end of each period?', a: 'Contributing at the start gives each deposit one extra period of growth, so the final value is slightly higher. Over decades the difference can be noticeable.' },
    { q: 'What return should I expect?', a: 'No return is guaranteed. Long-run stock market averages have been around 7–10% a year before inflation, but individual years vary widely. Test pessimistic and optimistic rates.' },
  ],
  sip: [
    { q: 'What is the SIP formula?', a: 'For monthly SIPs: FV = P × ((1+i)<sup>n</sup> − 1) ÷ i × (1+i), where P is the monthly amount, i the expected monthly return and n the number of instalments — assuming each instalment is invested at the start of the month.' },
    { q: 'What is a step-up SIP?', a: 'A step-up (top-up) SIP raises your monthly instalment by a fixed percentage each year, usually in line with salary increases. It can grow the final corpus substantially compared with a flat SIP.' },
    { q: 'Are SIP returns guaranteed?', a: 'No. Mutual fund returns depend on the market. The calculator uses a constant rate for illustration; actual returns will be higher in some years and lower or negative in others.' },
  ],
  cagr: [
    { q: 'What is the CAGR formula?', a: 'CAGR = (ending value ÷ beginning value)<sup>1/years</sup> − 1. It is the constant yearly growth rate that would turn the starting value into the ending value.' },
    { q: 'Why is CAGR better than average return?', a: 'A +50% year followed by a −50% year has an average return of 0% but leaves you with 25% less money. CAGR (−13.4% a year here) reflects what really happened.' },
    { q: 'Can CAGR be used for revenue or users?', a: 'Yes — CAGR works for any value that grows over time, such as company revenue, population or website traffic.' },
  ],
  depreciation: [
    { q: 'What is straight-line depreciation?', a: 'The cost minus salvage value is spread evenly over the useful life: yearly depreciation = (cost − salvage) ÷ life.' },
    { q: 'How does declining balance depreciation work?', a: 'Each year a fixed percentage is applied to the remaining book value. Double-declining balance uses 2 ÷ life; it front-loads depreciation and the schedule never goes below the salvage value.' },
    { q: 'What is sum-of-the-years\'-digits?', a: 'An accelerated method: for a 5-year asset the digits add to 15, so year 1 depreciates 5/15 of the depreciable base, year 2 4/15, and so on.' },
    { q: 'Is this the same as tax depreciation?', a: 'Not necessarily. Tax systems such as the U.S. MACRS or national capital-allowance rules have their own rates and conventions. Use this for accounting estimates and check tax rules with an accountant.' },
  ],
  'rent-vs-buy': [
    { q: 'How does the rent vs buy comparison work?', a: 'It totals the cost of owning (mortgage interest, property tax, insurance, maintenance, transaction costs) minus home appreciation, and compares it with renting plus investing the money you would have used for the down payment and any monthly savings.' },
    { q: 'What is the price-to-rent ratio?', a: 'Home price ÷ yearly rent. Roughly, below 15 tends to favour buying, above 20 tends to favour renting — but interest rates, how long you stay and local appreciation matter more.' },
    { q: 'How long should I stay to make buying worthwhile?', a: 'Buying and selling costs often total 6–10% of the home price, so ownership usually needs several years (often 5 or more) to beat renting. The calculator shows the break-even year for your inputs.' },
  ],
  'debt-to-income': [
    { q: 'How is DTI calculated?', a: 'DTI = total monthly debt payments ÷ gross monthly income × 100%. Front-end DTI counts housing costs only; back-end DTI counts all debts (housing, cars, cards, student loans).' },
    { q: 'What DTI do lenders want?', a: 'A common guideline is 28% front-end and 36% back-end. U.S. qualified mortgages are often allowed up to about 43%, and some programmes go higher with strong credit.' },
    { q: 'Do living expenses count in DTI?', a: 'No. Groceries, utilities, insurance (other than housing) and phone bills are not debts, so they are not included — but you should still budget for them.' },
  ],
  'net-worth': [
    { q: 'How is net worth calculated?', a: 'Net worth = total assets − total liabilities. Assets include cash, investments, retirement accounts, property and vehicles; liabilities include mortgages, loans and credit card balances.' },
    { q: 'Should I include my home?', a: 'Yes, at a realistic market value, with the mortgage as a liability. Some people also track net worth excluding their home to see their liquid position.' },
    { q: 'What is the debt-to-asset ratio?', a: 'Total liabilities ÷ total assets. Below 0.5 means you own more than half of your assets outright; lower is generally stronger.' },
  ],
  'npv-irr': [
    { q: 'What is net present value (NPV)?', a: 'NPV discounts each future cash flow back to today at your required rate and adds them up: NPV = Σ CF<sub>t</sub> ÷ (1+r)<sup>t</sup>. A positive NPV means the project earns more than the discount rate.' },
    { q: 'What is the internal rate of return (IRR)?', a: 'IRR is the discount rate that makes NPV exactly zero. It is found numerically. If IRR is above your cost of capital, the project adds value.' },
    { q: 'Why can NPV and IRR disagree?', a: 'IRR assumes cash flows are reinvested at the IRR itself and can give multiple answers when cash flows change sign more than once. When comparing mutually exclusive projects, NPV is the more reliable guide.' },
    { q: 'What is discounted payback?', a: 'The time until the cumulative discounted cash flows turn positive. It is stricter than simple payback because later cash flows are worth less.' },
  ],
  'interest-rate': [
    { q: 'How is the interest rate found from a payment?', a: 'There is no closed-form solution, so the calculator solves the loan payment formula numerically (by bisection) for the rate that makes the payments repay the amount borrowed over the term.' },
    { q: 'Why is the real rate higher than advertised?', a: 'Add-on or flat-rate loans charge interest on the original amount for the whole term, and fees can be deducted upfront. Entering the actual amount received and payment reveals the true APR.' },
    { q: 'Is the result an APR or an effective rate?', a: 'It is the nominal annual rate (monthly rate × 12), which is how APR is quoted. The effective annual rate, (1 + monthly rate)<sup>12</sup> − 1, is slightly higher.' },
  ],
  'house-affordability': [
    { q: 'What is the 28/36 rule?', a: 'Lenders often like housing costs to stay under 28% of gross monthly income and total debt payments under 36%. The calculator uses the lower of the two limits to find your maximum payment.' },
    { q: 'What costs are included in the housing payment?', a: 'Principal and interest plus property tax, homeowners insurance and HOA dues. The maximum home price is the price whose total payment fits your limit after the down payment.' },
    { q: 'Should I borrow the maximum I qualify for?', a: 'Not necessarily. Leave room for maintenance (often 1–2% of the home value a year), emergencies, retirement saving and rate changes.' },
  ],

  // ───────────── Health ─────────────
  bmi: [
    { q: 'How is BMI calculated?', a: 'BMI = weight (kg) ÷ height (m)². In imperial units it is 703 × weight (lb) ÷ height (in)².' },
    { q: 'What is a healthy BMI?', a: 'The World Health Organization classes adults as underweight below 18.5, normal 18.5–24.9, overweight 25–29.9 and obese 30 or above. Some Asian health authorities use lower cut-offs (e.g. 23 for overweight).' },
    { q: 'Is BMI accurate for everyone?', a: 'No. BMI does not distinguish muscle from fat, so athletes can be classed as overweight, and it is less reliable for older adults. Waist circumference and body-fat estimates add useful context.' },
    { q: 'Can I use BMI for children?', a: 'Adult categories do not apply to children and teens. Their BMI is compared with age- and sex-specific growth percentiles (CDC or WHO charts).' },
  ],
  calorie: [
    { q: 'How are daily calorie needs estimated?', a: 'The calculator estimates your BMR (Mifflin–St Jeor by default, or Harris–Benedict / Katch–McArdle) and multiplies it by an activity factor (1.2 sedentary to about 1.9 very active) to get your total daily energy expenditure (TDEE).' },
    { q: 'How many calories should I cut to lose weight?', a: 'A deficit of about 500 kcal a day is a common starting point for roughly 0.5 kg (1 lb) per week. Very low-calorie diets should be supervised by a healthcare professional.' },
    { q: 'Why is my real calorie burn different?', a: 'Formulas are population averages and can be off by 10% or more for an individual. Track your weight for 2–3 weeks and adjust your intake based on the trend.' },
  ],
  bmr: [
    { q: 'What is BMR?', a: 'Basal metabolic rate is the energy your body uses at complete rest to keep you alive — breathing, circulation and cell repair. It is usually 60–70% of total daily calories.' },
    { q: 'Which BMR formula is the most accurate?', a: 'Mifflin–St Jeor is generally considered the most accurate for most adults. Revised Harris–Benedict is an older alternative, and Katch–McArdle is better if you know your body-fat percentage.' },
    { q: 'How do I get daily calories from BMR?', a: 'Multiply BMR by an activity factor: about 1.2 for sedentary, 1.375 lightly active, 1.55 moderately active, 1.725 very active and 1.9 extra active.' },
  ],
  'body-fat': [
    { q: 'How does the U.S. Navy method work?', a: 'It estimates body fat from height and circumference measurements — neck and waist for men, plus hips for women — using logarithmic equations developed by the U.S. Navy. It is typically within a few percentage points of lab methods.' },
    { q: 'How should I measure?', a: 'Use a soft tape, keep it level and snug but not compressing the skin. Measure the waist at the navel for men and at the narrowest point for women, the neck just below the larynx and the hips at the widest point.' },
    { q: 'What is a healthy body fat percentage?', a: 'The American Council on Exercise lists about 14–24% as "fitness to average" for men and 21–31% for women. Essential fat is roughly 2–5% for men and 10–13% for women.' },
  ],
  'ideal-weight': [
    { q: 'Why are there several ideal weight formulas?', a: 'Devine, Robinson, Miller and Hamwi each fitted slightly different data. They were designed mainly for medication dosing, so the range across them is more useful than any single number.' },
    { q: 'What is the healthy BMI weight range?', a: 'It is the weight range that keeps your BMI between 18.5 and 24.9 for your height — a broader and more modern guide than the classic formulas.' },
    { q: 'Do these formulas work for very short or tall people?', a: 'They are less reliable below about 152 cm (5 ft) or for very tall people, and they ignore frame size and muscle mass.' },
  ],
  pace: [
    { q: 'How is pace calculated?', a: 'Pace = time ÷ distance (for example minutes per km); speed is the inverse, distance ÷ time.' },
    { q: 'How are race finish times projected?', a: 'Projected times assume you hold the same pace for the whole distance. In practice runners slow over longer races; Riegel\'s formula T₂ = T₁ × (D₂ ÷ D₁)<sup>1.06</sup> is a popular way to allow for that.' },
    { q: 'How do I convert min/km to min/mile?', a: 'Multiply by 1.609. A 5:00 min/km pace is about 8:03 min/mile.' },
  ],
  'due-date': [
    { q: 'How is the due date calculated?', a: 'By Naegele\'s rule: 280 days (40 weeks) after the first day of your last menstrual period, adjusted if your cycle is longer or shorter than 28 days.' },
    { q: 'How accurate is the due date?', a: 'Only about 4–5% of babies arrive on their due date; most are born within two weeks either side. An early ultrasound gives the most accurate dating.' },
    { q: 'How are pregnancy weeks counted?', a: 'From the first day of the last period, so you are considered about two weeks pregnant at conception. The first trimester ends at 13 weeks and the second at 27 weeks.' },
  ],
  'heart-rate': [
    { q: 'What is the Karvonen method?', a: 'Target HR = resting HR + intensity × (max HR − resting HR). Using heart-rate reserve personalises zones better than a simple percentage of maximum heart rate.' },
    { q: 'How is maximum heart rate estimated?', a: 'The classic estimate is 220 − age; the Tanaka formula 208 − 0.7 × age is often more accurate for adults. A supervised exercise test gives the true value.' },
    { q: 'Which zone burns the most fat?', a: 'Lower zones use a higher proportion of fat, but higher intensities burn more total calories. A mix of easy and harder sessions is best for fitness and weight control.' },
  ],
  sleep: [
    { q: 'Why does the calculator use 90-minute cycles?', a: 'Sleep moves through light, deep and REM stages in cycles of roughly 90 minutes. Waking at the end of a cycle, rather than in deep sleep, usually feels less groggy.' },
    { q: 'How much sleep do adults need?', a: 'The American Academy of Sleep Medicine recommends at least 7 hours a night for adults; teenagers need 8–10 hours.' },
    { q: 'Does it account for falling asleep?', a: 'Yes — it adds the average time to fall asleep (about 15 minutes) before counting cycles. You can adjust it if you usually fall asleep faster or slower.' },
  ],
  macro: [
    { q: 'How are macros calculated?', a: 'Daily calories come from your TDEE (Mifflin–St Jeor BMR × activity) adjusted for your goal, then split between protein, carbohydrate and fat using the diet type you choose — e.g. 30/40/30 — and converted to grams.' },
    { q: 'How many calories are in each macro?', a: 'Protein and carbohydrates have about 4 kcal per gram, fat about 9 kcal per gram (and alcohol about 7).' },
    { q: 'How much protein do I need?', a: 'The basic RDA is 0.8 g/kg, but people who train regularly or are losing weight often benefit from about 1.6–2.2 g/kg to preserve muscle.' },
  ],
  ovulation: [
    { q: 'When does ovulation happen?', a: 'Usually about 14 days before the next period starts — day 14 of a 28-day cycle, but day 21 of a 35-day cycle. The luteal phase is more constant than the follicular phase.' },
    { q: 'What is the fertile window?', a: 'The five days before ovulation plus the day of ovulation, because sperm can survive up to five days and the egg about 24 hours.' },
    { q: 'Can I use this as contraception?', a: 'No. Cycles vary and the estimate can be off by several days. Ovulation tests or tracking basal body temperature are more accurate, but none are a reliable form of birth control on their own.' },
  ],

  // ───────────── Math ─────────────
  scientific: [
    { q: 'Does the calculator use degrees or radians?', a: 'You can switch between DEG and RAD. In degree mode sin(30) = 0.5; in radian mode sin(π/6) = 0.5.' },
    { q: 'What order of operations is used?', a: 'Standard precedence: brackets, powers and roots (right-to-left), multiplication and division, then addition and subtraction. Implicit multiplication such as 2π or 3(4+1) is supported.' },
    { q: 'Can I use my keyboard?', a: 'Yes. Type numbers and operators directly, press Enter for = and Backspace to delete. The history keeps your recent calculations.' },
    { q: 'Is my data sent anywhere?', a: 'No. Expressions are evaluated by a safe parser in your browser — nothing is sent to a server.' },
  ],
  percentage: [
    { q: 'How do I calculate a percentage of a number?', a: 'Multiply the number by the percentage and divide by 100: 15% of 80 = 80 × 15 ÷ 100 = 12.' },
    { q: 'How is percentage change calculated?', a: '(new − old) ÷ old × 100%. Going from 50 to 65 is a 30% increase; from 65 back to 50 is a 23.1% decrease.' },
    { q: 'What is the difference between percent and percentage points?', a: 'A rate rising from 4% to 5% is a 1 percentage point increase but a 25% relative increase.' },
  ],
  fraction: [
    { q: 'How do you add fractions with different denominators?', a: 'Rewrite them over a common denominator (the LCM of the denominators), add the numerators and simplify: 1/4 + 1/6 = 3/12 + 2/12 = 5/12.' },
    { q: 'How do you divide fractions?', a: 'Multiply by the reciprocal of the second fraction: (2/3) ÷ (4/5) = (2/3) × (5/4) = 10/12 = 5/6.' },
    { q: 'How are fractions simplified?', a: 'Divide the numerator and denominator by their greatest common divisor. 18/24 has GCD 6, so it simplifies to 3/4.' },
  ],
  quadratic: [
    { q: 'What is the quadratic formula?', a: 'x = (−b ± √(b² − 4ac)) ÷ 2a solves ax² + bx + c = 0 for any a ≠ 0.' },
    { q: 'What does the discriminant tell you?', a: 'D = b² − 4ac. If D &gt; 0 there are two real roots, if D = 0 one repeated root, and if D &lt; 0 two complex conjugate roots.' },
    { q: 'How is the vertex found?', a: 'The vertex is at x = −b ÷ 2a, and y is the value of the equation at that x. It is the minimum of the parabola if a &gt; 0 and the maximum if a &lt; 0.' },
  ],
  statistics: [
    { q: 'What is the difference between sample and population standard deviation?', a: 'Population SD divides the sum of squared deviations by n; sample SD divides by n − 1 (Bessel\'s correction) to avoid underestimating the spread of the wider population.' },
    { q: 'How is the median found?', a: 'Sort the numbers and take the middle one; with an even count, average the two middle values.' },
    { q: 'How are quartiles calculated?', a: 'Several conventions exist. This calculator interpolates linearly between data points — the same method as Excel\'s QUARTILE.INC — so other software may differ slightly.' },
  ],
  'gcd-lcm': [
    { q: 'How is the greatest common factor found?', a: 'With the Euclidean algorithm: repeatedly replace the larger number by the remainder of dividing it by the smaller, until the remainder is 0. For more than two numbers apply it pairwise.' },
    { q: 'How is the LCM related to the GCF?', a: 'For two numbers, LCM(a, b) = |a × b| ÷ GCF(a, b). For example, GCF(12, 18) = 6, so LCM = 216 ÷ 6 = 36.' },
    { q: 'Where are GCF and LCM used?', a: 'GCF simplifies fractions and ratios; LCM finds common denominators and solves scheduling problems such as when two repeating events next coincide.' },
  ],
  prime: [
    { q: 'What is a prime number?', a: 'A whole number greater than 1 whose only divisors are 1 and itself. 2 is the only even prime; 1 is not prime.' },
    { q: 'How does the checker test for primes?', a: 'It runs a deterministic Miller–Rabin test, which is exact for every number below 3.3 × 10<sup>24</sup>, and factors composites with trial division plus Pollard\'s rho — so even 20-digit numbers are instant.' },
    { q: 'What is prime factorization?', a: 'Writing a number as a product of primes, e.g. 360 = 2³ × 3² × 5. Every whole number above 1 has exactly one prime factorization.' },
  ],
  random: [
    { q: 'Are the numbers truly random?', a: 'They come from the browser\'s cryptographically secure generator (crypto.getRandomValues), which is suitable for draws and games. Rejection sampling avoids modulo bias, so every number in the range is exactly equally likely.' },
    { q: 'Can I generate numbers without repeats?', a: 'Yes. Turn off repeats and the generator draws unique numbers, like drawing tickets from a hat. You cannot ask for more unique numbers than the range contains.' },
    { q: 'Can I use it for a lottery or giveaway?', a: 'It is fine for informal draws. Official lotteries and regulated contests may require certified equipment and audit trails.' },
  ],
  triangle: [
    { q: 'What is the Pythagorean theorem?', a: 'In a right triangle, a² + b² = c², where c is the hypotenuse (the side opposite the right angle).' },
    { q: 'How are the angles found?', a: 'With trigonometric ratios: sin A = opposite ÷ hypotenuse, cos A = adjacent ÷ hypotenuse and tan A = opposite ÷ adjacent. The two acute angles always add to 90°.' },
    { q: 'What inputs do I need?', a: 'Any two values, at least one of which is a side. Two angles alone fix the shape but not the size.' },
  ],
  'area-volume': [
    { q: 'What is the area of a circle?', a: 'A = πr², and the circumference is 2πr, where r is the radius.' },
    { q: 'What is the volume of a cylinder and a sphere?', a: 'Cylinder: V = πr²h. Sphere: V = 4/3 πr³, with surface area 4πr².' },
    { q: 'Which units are the results in?', a: 'Area is in square units and volume in cubic units of whatever length unit you enter — e.g. metres give m² and m³.' },
  ],
  logarithm: [
    { q: 'What is a logarithm?', a: 'log<sub>b</sub>(x) is the power you raise b to in order to get x. log₁₀(1000) = 3 because 10³ = 1000.' },
    { q: 'How do I calculate a log with any base?', a: 'Use the change-of-base rule: log<sub>b</sub>(x) = ln(x) ÷ ln(b). The calculator does this for any positive base other than 1.' },
    { q: 'What is the difference between log and ln?', a: '"log" usually means base 10 (common logarithm); "ln" is the natural logarithm with base e ≈ 2.71828.' },
  ],
  'scientific-notation': [
    { q: 'What is scientific notation?', a: 'A number written as a × 10<sup>n</sup>, where 1 ≤ |a| &lt; 10 and n is an integer: 45,000 = 4.5 × 10⁴.' },
    { q: 'What is E-notation?', a: 'The calculator and programming form of scientific notation: 4.5E4 means 4.5 × 10⁴.' },
    { q: 'How is engineering notation different?', a: 'The exponent is always a multiple of 3, matching SI prefixes such as kilo, mega and micro: 45,000 = 45 × 10³.' },
  ],
  'sig-figs': [
    { q: 'Which digits are significant?', a: 'All non-zero digits, zeros between them, and trailing zeros after a decimal point. Leading zeros are never significant: 0.00450 has three significant figures.' },
    { q: 'Are trailing zeros in whole numbers significant?', a: 'They are ambiguous: 1500 could have 2, 3 or 4. Write it in scientific notation (1.50 × 10³) or with a decimal point (1500.) to make it clear.' },
    { q: 'How many significant figures should a result have?', a: 'For multiplication and division, round to the fewest significant figures in the inputs; for addition and subtraction, round to the fewest decimal places.' },
  ],
  ratio: [
    { q: 'How do you solve a proportion?', a: 'Cross-multiply: if A : B = C : D then A × D = B × C, so a missing value is found by dividing, e.g. D = B × C ÷ A.' },
    { q: 'How do you simplify a ratio?', a: 'Divide every term by their greatest common divisor: 12 : 18 simplifies to 2 : 3.' },
    { q: 'Where are ratios used?', a: 'Scaling recipes, maps and drawings, mixing concrete or paint, screen aspect ratios and sharing money in proportion.' },
  ],
  'weighted-average': [
    { q: 'How is a weighted average calculated?', a: 'Multiply each value by its weight, add the products, and divide by the sum of the weights: Σ(w × x) ÷ Σw.' },
    { q: 'Do the weights have to add up to 100?', a: 'No. Weights can be percentages, credits or any positive numbers — dividing by their sum normalises them.' },
    { q: 'When should I use a weighted average?', a: 'Whenever items count differently: course grades with different credit hours, portfolio returns weighted by amount invested, or average prices weighted by quantity.' },
  ],
  'percent-error': [
    { q: 'What is the percent error formula?', a: 'Percent error = |measured − true| ÷ |true| × 100%.' },
    { q: 'Can percent error be negative?', a: 'With the absolute value it is always positive. Some lab courses keep the sign to show whether the measurement was above or below the true value.' },
    { q: 'What is a good percent error?', a: 'It depends on the experiment. In school labs, under about 5% is often considered good, but precision instruments may need errors well below 1%.' },
  ],

  // ───────────── Converters ─────────────
  'unit-converter': [
    { q: 'How accurate are the conversions?', a: 'Conversions use exact definitions where they exist — for example 1 inch = 2.54 cm and 1 lb = 0.45359237 kg exactly — so results are accurate to the displayed precision.' },
    { q: 'How do Bangladeshi and Indian land units convert?', a: 'Local units vary by region. The converter uses common values such as the common Bangladesh standard: 1 decimal (shotok) = 435.6 sq ft, 1 katha = 720 sq ft and 1 bigha = 33 decimal (about 20 katha). Sizes vary by region, so check the local standard for legal documents.' },
    { q: 'How do I convert Celsius to Fahrenheit?', a: '°F = °C × 9/5 + 32, and °C = (°F − 32) × 5/9. Temperature scales have different zero points, so they cannot be converted by multiplying alone.' },
    { q: 'Why are there two kinds of gallons?', a: 'The U.S. gallon is 3.785 L and the imperial (UK) gallon is 4.546 L. Fuel economy in miles per gallon differs between the two.' },
  ],
  'base-converter': [
    { q: 'How do you convert decimal to binary?', a: 'Repeatedly divide by 2 and write the remainders in reverse order. 13 → 1101 because 13 = 8 + 4 + 1.' },
    { q: 'Why is hexadecimal used in computing?', a: 'Each hex digit represents exactly 4 bits, so a byte is two hex digits (00–FF). It is a compact way to write binary data, memory addresses and colours.' },
    { q: 'What bases are supported?', a: 'Any base from 2 to 36, using digits 0–9 and letters A–Z for values 10–35. Large integers are handled exactly.' },
  ],
  'roman-numerals': [
    { q: 'What are the Roman numeral symbols?', a: 'I = 1, V = 5, X = 10, L = 50, C = 100, D = 500, M = 1000.' },
    { q: 'How does subtractive notation work?', a: 'A smaller numeral before a larger one is subtracted: IV = 4, IX = 9, XL = 40, XC = 90, CD = 400, CM = 900. Only these six pairs are standard.' },
    { q: 'Why does the converter stop at 3999?', a: 'Standard Roman numerals have no symbol above M, and a symbol may repeat at most three times, so MMMCMXCIX (3999) is the largest regular number.' },
  ],

  // ───────────── Bangladesh ─────────────
  'bd-income-tax': [
    { q: 'Who has to file an income tax return in Bangladesh?', a: 'Anyone whose income exceeds the tax-free threshold, and many people regardless of income — for example those who hold a TIN and need proof of return submission (PSR) for a loan, credit card, trade licence or savings certificates above set limits. Check the National Board of Revenue (nbr.gov.bd) for the full list.' },
    { q: 'What is the difference between income year and assessment year?', a: 'The income year is the fiscal year (1 July – 30 June) in which you earn the income. The assessment year is the following year, when the return is filed and assessed. The calculator lets you choose the year; rates are listed in the about section with their legal source.' },
    { q: 'How does the investment tax rebate work?', a: 'Eligible investments (savings certificates, DPS, life insurance, approved shares and funds, etc.) earn a rebate equal to the lowest of a percentage of taxable income, a percentage of the investment and a fixed cap. The calculator applies the limits for the year you select.' },
    { q: 'When is the return due?', a: 'For individuals the normal deadline (Tax Day) is 30 November after the end of the income year, unless the NBR extends it. Late filing can incur penalties and loss of some exemptions.' },
    { q: 'Does this cover tax on salary, rent and business income?', a: 'It works on your total taxable income after allowable exemptions. Income taxed at final or reduced rates (such as some capital gains) and the net-wealth surcharge are not included.' },
  ],
  'bd-sanchayapatra': [
    { q: 'Which Sanchayapatra pays monthly profit?', a: 'Paribar Sanchayapatra pays profit monthly. The 3-month profit-based and Pensioner Sanchayapatra pay quarterly, and the 5-year Bangladesh Sanchayapatra pays all profit at maturity.' },
    { q: 'Is tax deducted from Sanchayapatra profit?', a: 'Yes, source tax is deducted from every profit payment. The current rate and whether it is final or adjustable are shown in the calculator\'s about section with the Finance Act it comes from.' },
    { q: 'What happens if I cash a certificate early?', a: 'Premature encashment pays a lower rate for the period held (and nothing in the first year for most schemes), and excess profit already paid is deducted from the principal. This calculator models holding to maturity.' },
    { q: 'Is there an investment limit?', a: 'Yes. The Department of National Savings sets individual and joint limits for each scheme (Paribar Sanchayapatra, for example, is only for women, persons aged 65+ and certain other groups). Check nationalsavings.gov.bd before buying.' },
  ],
  'bd-fdr': [
    { q: 'How much tax is deducted from FDR interest?', a: 'Banks deduct source tax on interest — a lower rate if you have a TIN or proof of return and a higher rate if you do not. It is adjustable against your final tax, so include the interest in your return.' },
    { q: 'What is excise duty on bank accounts?', a: 'A government duty charged once a year on each deposit account based on the highest balance during the calendar year. Small balances are exempt; the slabs are listed in the about section.' },
    { q: 'Is it better to take monthly interest or let the FDR compound?', a: 'Letting interest compound (auto-renewal) gives a higher maturity value. Monthly-income FDRs pay a regular income but no interest on interest.' },
  ],
  'bd-dps': [
    { q: 'How is DPS maturity calculated?', a: 'Each monthly instalment earns interest from the month it is deposited, and interest is added to the balance at the compounding interval. Source tax and yearly excise duty are deducted to give the net maturity amount.' },
    { q: 'What happens if I miss DPS instalments?', a: 'Most banks charge a late fee and may close the account after several missed instalments, paying a lower savings rate. Check your bank\'s DPS terms.' },
    { q: 'Why is my bank\'s maturity table slightly different?', a: 'Banks round instalments, interest and duty differently and may credit interest on different dates. Differences of a few hundred taka are normal.' },
  ],
  'bd-gold-price': [
    { q: 'How many grams is one vori (bhori)?', a: 'One vori is 11.664 grams. It is divided into 16 ana; one ana is 6 rati (about 0.729 g) and one rati is 10 points.' },
    { q: 'What is the difference between 22K, 21K and 18K gold?', a: 'Karat measures purity out of 24: 22K is about 91.6% gold, 21K 87.5% and 18K 75%. Lower-karat gold is harder and cheaper. "Traditional" gold is priced separately by BAJUS.' },
    { q: 'How is the final jewellery price worked out?', a: 'Weight × price per vori for the purity, plus the making charge (mojuri) and VAT. The calculator shows each part separately so you can compare shop quotes.' },
    { q: 'Where can I find today\'s gold price?', a: 'The Bangladesh Jewellers Association (BAJUS) announces prices on bajus.org and they are widely reported in the press. Enter the current rate for an accurate result.' },
  ],
  'bd-electricity-bill': [
    { q: 'How are residential electricity slabs applied?', a: 'Slabs are telescopic: the first units are billed at the lowest rate, the next units at the next rate, and so on. Only very low users qualify for the lifeline rate on all units.' },
    { q: 'What is the demand charge?', a: 'A fixed monthly charge per kilowatt of sanctioned load on your meter, added regardless of how many units you use.' },
    { q: 'Is VAT charged on electricity bills?', a: 'Yes, VAT is added to the energy and demand charges. The current rates and their BERC source are listed in the about section.' },
    { q: 'Does it work for prepaid meters?', a: 'Yes — prepaid customers are billed on the same tariff, though the meter deducts demand charge and VAT as you recharge and may show small rebates.' },
  ],
  'bd-govt-pension': [
    { q: 'How is government pension calculated in Bangladesh?', a: 'Gross pension = last basic pay × a rate based on completed qualifying service (up to 90% after 25 years). At least half is commuted to a one-off gratuity; the remainder is the monthly net pension.' },
    { q: 'What is gratuity (anutoshik)?', a: 'The lump sum paid for the commuted part of the pension: commuted monthly pension × a rate per taka that depends on length of service. Surrendering 100% doubles the rate but leaves no monthly pension.' },
    { q: 'What allowances do pensioners receive?', a: 'Medical allowance, two festival allowances a year, the Bangla New Year allowance and an annual increase on net pension. The calculator includes these using the rates in its about section.' },
    { q: 'Why might my PPO show different figures?', a: 'Pension payment orders apply rounding and phased revisions. Use the override fields to match your PPO exactly.' },
  ],
  'bd-gpf': [
    { q: 'What is the current GPF profit rate?', a: 'The Finance Division sets slab rates each fiscal year, with a higher rate on the first part of the balance and lower rates above. The rates used, and the fiscal year they apply to, are shown in the about section.' },
    { q: 'How is GPF profit calculated?', a: 'Profit is worked out monthly on the balance at the slab rates and credited at the end of the fiscal year, so it compounds annually.' },
    { q: 'Is GPF profit taxable?', a: 'Income from a recognised/statutory provident fund such as GPF is generally exempt from income tax in Bangladesh. Confirm the current position with the NBR or your tax adviser.' },
  ],

  // ───────────── Everyday ─────────────
  age: [
    { q: 'How is exact age calculated?', a: 'It counts full years since your birth date, then full months, then the remaining days, taking each month\'s real length and leap years into account.' },
    { q: 'What if I was born on 29 February?', a: 'In common years the calculator counts your birthday on 28 February, the convention in many countries. Some jurisdictions (the UK for legal purposes, for example) use 1 March instead.' },
    { q: 'Can I calculate age at a past or future date?', a: 'Yes. Change the "age at" date to any date to see how old someone was or will be then.' },
  ],
  'date-difference': [
    { q: 'Does the result include the end date?', a: 'By default the end date is not counted (like subtracting dates). Turn on "include end date" to add one day, which is common for leave and rental periods.' },
    { q: 'How are business days counted?', a: 'Weekend days are removed — Saturday–Sunday or Friday–Saturday, as used in Bangladesh and much of the Middle East. Public holidays vary and are not removed automatically.' },
    { q: 'Why can months be counted in different ways?', a: 'Months have 28–31 days, so "months between" counts whole calendar months and then the leftover days, which matches how people usually describe durations.' },
  ],
  'date-add': [
    { q: 'What happens when adding a month to 31 January?', a: 'February has no 31st, so the result moves to the last day of February (28th or 29th), which is the usual convention in contracts and spreadsheets.' },
    { q: 'Can I add business days only?', a: 'Yes. Choose business days and weekends are skipped. Public holidays are not skipped automatically.' },
    { q: 'How do I count backwards?', a: 'Choose subtract to find the date a given number of days, weeks, months or years before your start date.' },
  ],
  'time-duration': [
    { q: 'What if the end time is after midnight?', a: 'If the end time is earlier than the start time, the calculator assumes the shift crosses midnight and adds 24 hours.' },
    { q: 'How do I convert hours and minutes to decimal hours?', a: 'Divide the minutes by 60: 7 h 45 min = 7.75 hours. Payroll systems often use decimal hours.' },
    { q: 'Can I subtract a break?', a: 'Yes — enter your unpaid break in minutes and it is taken off the total.' },
  ],
  gpa: [
    { q: 'How is GPA calculated?', a: 'Each grade is converted to points (A = 4.0, B = 3.0 …), multiplied by the course credits, summed, and divided by total credits.' },
    { q: 'Do plus and minus grades count?', a: 'On the common U.S. scale, A− = 3.7, B+ = 3.3, B− = 2.7 and so on. Schools differ, so check your institution\'s scale.' },
    { q: 'How do I calculate cumulative GPA?', a: 'Add your previous total credits and quality points to this term\'s, or enter all courses together. Cumulative GPA is weighted by credits, not an average of term GPAs.' },
  ],
  'fuel-cost': [
    { q: 'How is trip fuel cost calculated?', a: 'Fuel needed = distance ÷ efficiency (or distance × L/100 km ÷ 100), and cost = fuel needed × price per litre or gallon.' },
    { q: 'How do I convert mpg to L/100 km?', a: 'L/100 km = 235.215 ÷ US mpg (or 282.481 ÷ UK mpg). 30 US mpg is about 7.8 L/100 km.' },
    { q: 'How can I estimate a round trip?', a: 'Tick the round-trip option to double the distance. Add 10–20% for traffic, air conditioning or hilly roads.' },
  ],
  electricity: [
    { q: 'How is appliance running cost calculated?', a: 'kWh = watts × hours used ÷ 1000; cost = kWh × your price per kWh (unit).' },
    { q: 'Where do I find an appliance\'s wattage?', a: 'On the rating label or in the manual. Appliances with thermostats (fridges, ACs, heaters) cycle on and off, so real use is often lower than the label suggests.' },
    { q: 'What price per unit should I use?', a: 'Use the rate on your bill. If your tariff has slabs, the extra units an appliance adds are billed at your highest slab rate.' },
  ],
  password: [
    { q: 'How long should a password be?', a: 'At least 12–16 characters for important accounts. Length adds more strength than complexity; a random 16-character password is far beyond practical brute-force attacks.' },
    { q: 'Is it safe to generate passwords online?', a: 'This generator runs entirely in your browser using the cryptographically secure crypto.getRandomValues — nothing is sent or stored anywhere.' },
    { q: 'What does entropy mean?', a: 'Entropy (bits) = length × log₂(pool size). Each extra bit doubles the guesses needed; 80+ bits is considered very strong.' },
    { q: 'How should I remember my passwords?', a: 'Use a password manager and a unique password for every site, and turn on two-factor authentication where available.' },
  ],
  'day-of-week': [
    { q: 'How is the day of the week calculated?', a: 'From the date\'s day count in the proleptic Gregorian calendar (the same algorithm family as Zeller\'s congruence), so it works for past and future dates.' },
    { q: 'What is an ISO week number?', a: 'ISO 8601 weeks start on Monday, and week 1 is the week containing the year\'s first Thursday. Some years have 53 weeks.' },
    { q: 'How do I know if a year is a leap year?', a: 'Years divisible by 4 are leap years, except century years, which must also be divisible by 400. 2000 was a leap year; 1900 was not.' },
  ],
  countdown: [
    { q: 'Which holidays can I count down to?', a: 'Pick Christmas, New Year, Valentine\'s Day, Easter, Halloween or U.S. Thanksgiving and the next date is worked out automatically — or choose a specific date for birthdays, weddings and deadlines.' },
    { q: 'How are weeks and months shown?', a: 'Weeks are total days ÷ 7; months are whole calendar months plus remaining days, matching how people usually describe time until an event.' },
    { q: 'Can I count down to a past date?', a: 'If the date has passed, the calculator shows how many days ago it was.' },
  ],
  'time-card': [
    { q: 'How is overtime calculated?', a: 'Hours above the weekly threshold (40 hours under the U.S. Fair Labor Standards Act) are paid at the overtime multiplier, typically 1.5×. Some places calculate overtime daily — set the threshold to match your rules.' },
    { q: 'Should breaks be deducted?', a: 'Unpaid meal breaks are deducted; short paid rest breaks usually are not. Enter only unpaid break minutes.' },
    { q: 'Is the pay before tax?', a: 'Yes, it is gross pay. Taxes and other deductions are taken from it by your employer.' },
  ],
  concrete: [
    { q: 'How do I calculate concrete for a slab?', a: 'Volume = length × width × thickness. A 10 ft × 10 ft slab 4 in thick is 33.3 cu ft, or about 1.23 cubic yards.' },
    { q: 'How many bags of premix do I need?', a: 'A 60 lb bag yields about 0.45 cu ft and an 80 lb bag about 0.6 cu ft. The calculator divides your volume by the bag yield and rounds up.' },
    { q: 'How much extra should I order?', a: 'Add 5–10% for spillage, uneven ground and over-excavation. Running short mid-pour is far more costly than a little left over.' },
  ],
  tile: [
    { q: 'How many tiles do I need?', a: 'Divide the area by the area of one tile including the grout gap, then add waste. The calculator rounds up to whole tiles and boxes.' },
    { q: 'How much waste should I allow?', a: 'About 10% for a straight lay, and 15% or more for diagonal or herringbone patterns, many cuts or large-format tiles.' },
    { q: 'Should I keep spare tiles?', a: 'Yes — keep a few from the same batch for future repairs, because colour and size can vary between production lots.' },
  ],
  'square-footage': [
    { q: 'How do I calculate square footage?', a: 'For a rectangle, multiply length by width in feet. For an L-shaped room, split it into rectangles and add them together.' },
    { q: 'How do I convert square feet to square metres?', a: '1 sq ft = 0.092903 m², and 1 m² = 10.7639 sq ft.' },
    { q: 'Should I include closets and hallways?', a: 'For flooring or paint estimates, include every area you will cover. Real-estate listings follow local measurement standards, which may exclude some spaces.' },
  ],
  'final-grade': [
    { q: 'How is the required final exam score calculated?', a: 'Required = (target − current grade × (1 − final weight)) ÷ final weight, with the weight as a decimal.' },
    { q: 'What if the required score is over 100%?', a: 'Then the target is not reachable with the final alone unless extra credit is available. Try a lower target to see what is achievable.' },
    { q: 'What if my course has several categories?', a: 'Use your current weighted grade (as shown in your gradebook) for everything except the final.' },
  ],
};

export default FAQ;

/** Returns the FAQ list for a calculator id, or [] when none exists. */
export const faqFor = (id) => FAQ[id] || [];
