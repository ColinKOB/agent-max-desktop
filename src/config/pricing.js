export const WEEKLY_CREDITS = Object.freeze({
  starter: 225,
  premium: 400,
  pro: 700,
  free: 0,
});

export const CREDIT_PACKAGES = Object.freeze(
  [
    {
      id: 'small',
      name: 'Small Top-Up',
      credits: 250,
      price: 5,
      description: 'For occasional extra tasks',
    },
    {
      id: 'medium',
      name: 'Medium Top-Up',
      credits: 750,
      price: 12,
      popular: true,
      description: 'For regular project work',
    },
    {
      id: 'large',
      name: 'Large Top-Up',
      credits: 2000,
      price: 28,
      description: 'For sustained autonomous work',
    },
  ].map((item) =>
    Object.freeze({
      ...item,
      pricePerCredit: item.price / item.credits,
    })
  )
);
