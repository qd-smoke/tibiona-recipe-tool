// src/mock-data/recipes.ts
export type Recipe = {
  name: string;
  image: string;
  ingredients: string[];
  prepTime: string;
  cost: string;
};

export const recipes: Recipe[] = [
  {
    name: 'Pizza Margherita',
    image:
      'https://images.unsplash.com/photo-1598023696416-0193a0bcd302?q=80&w=2736&auto=format&fit=crop',
    ingredients: ['Flour', 'Tomato', 'Mozzarella', 'Basil'],
    prepTime: '25 min',
    cost: '€8.50',
  },
  {
    name: 'Pasta Carbonara',
    image:
      'https://images.unsplash.com/photo-1627207644206-a2040d60ecad?q=80&w=2574&auto=format&fit=crop',
    ingredients: ['Pasta', 'Eggs', 'Guanciale', 'Pecorino', 'Pepper'],
    prepTime: '20 min',
    cost: '€5.90',
  },
  {
    name: 'Chocolate Cake',
    image:
      'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?q=80&w=2304&auto=format&fit=crop',
    ingredients: ['Flour', 'Cocoa', 'Sugar', 'Butter', 'Eggs'],
    prepTime: '1 h 10 min',
    cost: '€6.30',
  },
  {
    name: 'Chicken Curry',
    image:
      'https://images.unsplash.com/photo-1672933036331-e27ffae157bd?q=80&w=2670&auto=format&fit=crop',
    ingredients: ['Chicken', 'Curry', 'Coconut milk', 'Onion'],
    prepTime: '40 min',
    cost: '€7.40',
  },
  {
    name: 'Vegetarian Bowl',
    image:
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=1200&auto=format&fit=crop',
    ingredients: ['Quinoa', 'Avocado', 'Chickpeas', 'Veggies'],
    prepTime: '30 min',
    cost: '€5.20',
  },
  {
    name: 'Sushi Platter',
    image:
      'https://images.unsplash.com/photo-1563612116625-3012372fccce?q=80&w=2656&auto=format&fit=crop',
    ingredients: ['Rice', 'Nori', 'Fish', 'Soy sauce', 'Wasabi'],
    prepTime: '50 min',
    cost: '€12.00',
  },
  {
    name: 'Beef Burger',
    image:
      'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=1200&auto=format&fit=crop',
    ingredients: ['Bun', 'Beef', 'Cheddar', 'Lettuce', 'Tomato'],
    prepTime: '30 min',
    cost: '€9.00',
  },
  {
    name: 'Greek Salad',
    image:
      'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?q=80&w=2574&auto=format&fit=crop',
    ingredients: ['Cucumber', 'Tomato', 'Feta', 'Olives', 'Onion'],
    prepTime: '15 min',
    cost: '€4.80',
  },
  {
    name: 'Pad Thai',
    image:
      'https://images.unsplash.com/photo-1637806930600-37fa8892069d?q=80&w=2570&auto=format&fit=crop',
    ingredients: ['Rice noodles', 'Shrimp', 'Peanuts', 'Tamarind'],
    prepTime: '35 min',
    cost: '€7.90',
  },
  {
    name: 'Avocado Toast',
    image:
      'https://images.unsplash.com/photo-1704545229893-4f1bb5ef16a1?q=80&w=2564&auto=format&fit=crop',
    ingredients: ['Bread', 'Avocado', 'Lemon', 'Chili flakes'],
    prepTime: '10 min',
    cost: '€3.50',
  },
  {
    name: 'Ramen Bowl',
    image:
      'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?q=80&w=1200&auto=format&fit=crop',
    ingredients: ['Noodles', 'Broth', 'Pork', 'Egg', 'Scallions'],
    prepTime: '1 h',
    cost: '€10.50',
  },
  {
    name: 'Tacos Al Pastor',
    image:
      'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?q=80&w=1200&auto=format&fit=crop',
    ingredients: ['Tortilla', 'Pork', 'Pineapple', 'Coriander'],
    prepTime: '45 min',
    cost: '€6.80',
  },
  {
    name: 'Shakshuka',
    image:
      'https://images.unsplash.com/photo-1520218576172-c1a2df3fa5fc?q=80&w=2670&auto=format&fit=crop',
    ingredients: ['Eggs', 'Tomato', 'Peppers', 'Onion', 'Spices'],
    prepTime: '30 min',
    cost: '€5.40',
  },
  {
    name: 'Pancakes',
    image:
      'https://images.unsplash.com/photo-1495214783159-3503fd1b572d?q=80&w=1200&auto=format&fit=crop',
    ingredients: ['Flour', 'Milk', 'Eggs', 'Butter', 'Syrup'],
    prepTime: '20 min',
    cost: '€3.80',
  },
  {
    name: 'Falafel Wrap',
    image:
      'https://images.unsplash.com/photo-1505577058444-a3dab90d4253?q=80&w=1200&auto=format&fit=crop',
    ingredients: ['Pita', 'Falafel', 'Tahini', 'Lettuce', 'Tomato'],
    prepTime: '35 min',
    cost: '€5.60',
  },
  {
    name: 'Caprese Salad',
    image:
      'https://images.unsplash.com/photo-1568605114967-8130f3a36994?q=80&w=1200&auto=format&fit=crop',
    ingredients: ['Tomato', 'Mozzarella', 'Basil', 'Olive oil'],
    prepTime: '10 min',
    cost: '€4.20',
  },
  {
    name: 'Grilled Salmon',
    image:
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1200&auto=format&fit=crop',
    ingredients: ['Salmon', 'Lemon', 'Herbs', 'Olive oil'],
    prepTime: '25 min',
    cost: '€12.50',
  },
  {
    name: 'Minestrone Soup',
    image:
      'https://images.unsplash.com/photo-1512058564366-18510be2db19?q=80&w=1200&auto=format&fit=crop',
    ingredients: ['Beans', 'Pasta', 'Veggies', 'Tomato broth'],
    prepTime: '50 min',
    cost: '€4.90',
  },
  {
    name: 'Bruschetta',
    image:
      'https://images.unsplash.com/photo-1506280754576-f6fa8a873550?q=80&w=2574&auto=format&fit=crop',
    ingredients: ['Bread', 'Tomato', 'Garlic', 'Basil'],
    prepTime: '15 min',
    cost: '€3.20',
  },
  {
    name: 'Lasagna',
    image:
      'https://images.unsplash.com/photo-1629115916087-7e8c114a24ed?q=80&w=2564&auto=format&fit=crop',
    ingredients: ['Pasta sheets', 'Ragù', 'Besciamella', 'Parmigiano'],
    prepTime: '1 h 30 min',
    cost: '€9.80',
  },
  {
    name: 'Poke Bowl',
    image:
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=1200&auto=format&fit=crop',
    ingredients: ['Rice', 'Salmon', 'Avocado', 'Edamame', 'Sesame'],
    prepTime: '25 min',
    cost: '€8.70',
  },
];
