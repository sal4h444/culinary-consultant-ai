/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { ChefHat, Utensils, Loader2, CheckCircle2, ShoppingCart, CalendarDays, ChevronDown, ChevronUp, BookOpen, Clock, Flame, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ai = new GoogleGenAI(import.meta.env.VITE_GEMINI_API_KEY);

const MEAL_TYPES = [
  'Breakfast', 'Brunch', 'Lunch', 'Dinner', 'Snack',
  'Afternoon Tea', 'Midnight Snack', 'Picnic', 'Banquet', 'Pre-workout', 'Post-workout'
];
const COURSES = [
  'Amuse-Bouche', 'Appetizer', 'Soup', 'Salad', 'Starter',
  'Main Course', 'Side Dish', 'Palate Cleanser', 'Cheese Course',
  'Dessert', 'Beverage', 'Cocktail', 'Digestif'
];

interface CourseSuggestion {
  courseType: string;
  recipeName: string;
  description: string;
  calories?: number;
}

interface DayPlan {
  dayOfWeek: string;
  courses: CourseSuggestion[];
}

interface GroceryItem {
  name: string;
  quantity: string;
}

interface GroceryAisle {
  aisle: string;
  items: GroceryItem[];
}

interface MealOption {
  themeName: string;
  days: DayPlan[];
  groceryList: GroceryAisle[];
}

interface RecipeDetails {
  loading: boolean;
  prepTime?: string;
  cookTime?: string;
  ingredients?: string[];
  steps?: string[];
  tips?: string[];
  error?: string;
}

export default function App() {
  const [selectedMealType, setSelectedMealType] = useState<string>('Dinner');
  const [selectedCourses, setSelectedCourses] = useState<string[]>(['Appetizer', 'Main Course', 'Dessert']);
  const [healthinessLevel, setHealthinessLevel] = useState<string>('Normal');
  const [targetCalories, setTargetCalories] = useState<string>('');
  const [duration, setDuration] = useState<number>(7);
  const [isLoading, setIsLoading] = useState(false);
  const [mealOptions, setMealOptions] = useState<MealOption[] | null>(null);
  const [expandedOptions, setExpandedOptions] = useState<number[]>([]);
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);
  const [recipeDetails, setRecipeDetails] = useState<Record<string, RecipeDetails>>({});
  const [error, setError] = useState<string | null>(null);

  const toggleCourse = (course: string) => {
    setSelectedCourses(prev => 
      prev.includes(course) 
        ? prev.filter(c => c !== course)
        : [...prev, course]
    );
  };

  const toggleOption = (index: number) => {
    setExpandedOptions(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const toggleRecipeInstructions = async (optionIndex: number, dayIndex: number, courseIndex: number, recipeName: string, description: string) => {
    const key = `${optionIndex}-${dayIndex}-${courseIndex}`;
    
    if (expandedRecipe === key) {
      setExpandedRecipe(null);
      return;
    }
    
    setExpandedRecipe(key);

    if (recipeDetails[key] && !recipeDetails[key].error) {
      return; // Already loaded or loading
    }

    setRecipeDetails(prev => ({ ...prev, [key]: { loading: true } }));

    try {
      const prompt = `Provide a detailed, comprehensive recipe guide in Arabic for the following dish:
Recipe Name: ${recipeName}
Description: ${description}

Include:
1. Preparation time (prepTime)
2. Cooking time (cookTime)
3. A detailed list of ingredients with exact measurements.
4. Clear, step-by-step cooking instructions.
5. Pro-tips or serving suggestions (optional).

Ensure the language is natural Arabic and the instructions are thorough enough for someone to follow perfectly.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              prepTime: { type: Type.STRING, description: "Preparation time, e.g., '15 دقيقة'" },
              cookTime: { type: Type.STRING, description: "Cooking time, e.g., '30 دقيقة'" },
              ingredients: {
                type: Type.ARRAY,
                items: { type: Type.STRING, description: "An ingredient with its measurement" }
              },
              steps: {
                type: Type.ARRAY,
                items: { type: Type.STRING, description: "A single preparation step" }
              },
              tips: {
                type: Type.ARRAY,
                items: { type: Type.STRING, description: "A helpful tip or serving suggestion" }
              }
            },
            required: ["prepTime", "cookTime", "ingredients", "steps"]
          }
        }
      });

      const data = JSON.parse(response.text);
      setRecipeDetails(prev => ({ 
        ...prev, 
        [key]: { 
          loading: false, 
          prepTime: data.prepTime,
          cookTime: data.cookTime,
          ingredients: data.ingredients,
          steps: data.steps,
          tips: data.tips
        } 
      }));
    } catch (error) {
      setRecipeDetails(prev => ({ ...prev, [key]: { loading: false, error: 'حدث خطأ أثناء تحميل تفاصيل الوصفة' } }));
    }
  };

  const generateMealPlan = async () => {
    if (selectedCourses.length === 0) {
      setError('Please select at least one course.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setMealOptions(null);
    setExpandedOptions([]);
    setExpandedRecipe(null);
    setRecipeDetails({});

    try {
      const prompt = `
Role: You are a Senior Meal Planner and Logistics Expert. Your task is to generate a comprehensive ${duration}-day meal plan based on a user's selected meal type and specific courses.

Task: The user has selected the meal type "${selectedMealType}" and the following courses: ${selectedCourses.join(', ')}.
Healthiness Level: ${healthinessLevel}
${targetCalories ? `Target Total Calories for the entire meal per day: approximately ${targetCalories} kcal.` : ''}

When a user inputs a duration (${duration} Days), generate three distinct ${duration}-day sets (Option A, Option B, and Option C). Each day must include a recommendation for every course requested.

Option A: "The Balanced Plan" (Focus on varied proteins and nutrients).
Option B: "The Gourmet Express" (Focus on flavor and efficiency).
Option C: "The Global Explorer" (Focus on international cuisines).

Task 2: The Logic of Choice
For every ${duration}-day set, you must conclude with a "Grocery Blueprint." This section must consolidate all ingredients needed for that specific set, categorized by the grocery aisle (e.g., Produce, Dairy, Pantry).

Strict Constraints:
Language: ALL generated content (themeName, dayOfWeek, courseType, recipeName, description, aisle, ingredient name, quantity) MUST be entirely in Arabic (اللغة العربية).
Variety: Ensure Option A, B, and C vary in difficulty, prep time, and cuisine style.
Cohesion: The courses within a single Option must make sense when eaten together.
Conciseness: Keep descriptions brief but mouth-watering. Do not provide full instructions unless asked in a follow-up.
Calories: Include estimated calories for each course. ${targetCalories ? `The sum of calories for all courses in a day should be close to ${targetCalories}.` : ''}
Ingredient Overlap: Try to suggest recipes within the plan that share some core ingredients to reduce food waste and grocery costs.
Quantity Estimation: Provide rough quantities in the grocery list (e.g., "500g Chicken Breast", "3 Large Onions").
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              options: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    themeName: { type: Type.STRING, description: "Theme Name, e.g., Option A: The Balanced Week" },
                    days: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          dayOfWeek: { type: Type.STRING, description: "Day of the week, e.g., Monday" },
                          courses: {
                            type: Type.ARRAY,
                            items: {
                              type: Type.OBJECT,
                              properties: {
                                courseType: { type: Type.STRING, description: "The course type, e.g., Soup, Salad, Main Course" },
                                recipeName: { type: Type.STRING, description: "Recipe Name" },
                                description: { type: Type.STRING, description: "30-word description of flavor and key ingredients" },
                                calories: { type: Type.NUMBER, description: "Estimated calories for this course" }
                              },
                              required: ["courseType", "recipeName", "description", "calories"]
                            }
                          }
                        },
                        required: ["dayOfWeek", "courses"]
                      }
                    },
                    groceryList: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          aisle: { type: Type.STRING, description: "Grocery aisle, e.g., Produce, Dairy, Pantry" },
                          items: {
                            type: Type.ARRAY,
                            items: {
                              type: Type.OBJECT,
                              properties: {
                                name: { type: Type.STRING, description: "Ingredient name" },
                                quantity: { type: Type.STRING, description: "Rough quantity, e.g., 500g, 3 Large" }
                              },
                              required: ["name", "quantity"]
                            }
                          }
                        },
                        required: ["aisle", "items"]
                      }
                    }
                  },
                  required: ["themeName", "days", "groceryList"]
                }
              }
            },
            required: ["options"]
          }
        }
      });

      if (response.text) {
        const data = JSON.parse(response.text);
        setMealOptions(data.options);
      } else {
        setError('Failed to generate meal plan. Please try again.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while generating the meal plan.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-orange-200">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-orange-600">
            <ChefHat className="w-6 h-6" />
            <h1 className="text-xl font-semibold tracking-tight">Culinary Consultant</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Sidebar / Controls */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Utensils className="w-5 h-5 text-stone-400" />
                Meal Configuration
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">Meal Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {MEAL_TYPES.map(type => (
                      <button
                        key={type}
                        onClick={() => setSelectedMealType(type)}
                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors border ${
                          selectedMealType === type 
                            ? 'bg-orange-50 border-orange-200 text-orange-700' 
                            : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">Courses</label>
                  <div className="flex flex-wrap gap-2">
                    {COURSES.map(course => {
                      const isSelected = selectedCourses.includes(course);
                      return (
                        <button
                          key={course}
                          onClick={() => toggleCourse(course)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border flex items-center gap-1.5 ${
                            isSelected 
                              ? 'bg-stone-800 border-stone-800 text-white' 
                              : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {course}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">Duration (Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="14"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl text-sm font-medium border bg-white border-stone-200 text-stone-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">Healthiness Level</label>
                  <select
                    value={healthinessLevel}
                    onChange={(e) => setHealthinessLevel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm font-medium border bg-white border-stone-200 text-stone-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Healthy">Healthy</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">Target Total Calories (Optional)</label>
                  <input
                    type="number"
                    value={targetCalories}
                    onChange={(e) => setTargetCalories(e.target.value)}
                    placeholder="e.g. 1500"
                    className="w-full px-3 py-2 rounded-xl text-sm font-medium border bg-white border-stone-200 text-stone-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <button
                  onClick={generateMealPlan}
                  disabled={isLoading || selectedCourses.length === 0}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Crafting Menu...
                    </>
                  ) : (
                    'Generate Meal Plans'
                  )}
                </button>
                
                {error && (
                  <p className="text-red-600 text-sm mt-2">{error}</p>
                )}
              </div>
            </div>
          </div>

          {/* Results Area */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex flex-col items-center justify-center h-64 text-stone-400 space-y-4"
                >
                  <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                  <p>Consulting the culinary archives...</p>
                </motion.div>
              ) : mealOptions ? (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  {mealOptions.map((option, index) => (
                    <div key={index} className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden" dir="rtl">
                      <div 
                        className="bg-stone-50 px-6 py-4 border-b border-stone-200 cursor-pointer flex items-center justify-between hover:bg-stone-100 transition-colors"
                        onClick={() => toggleOption(index)}
                      >
                        <h3 className="text-xl font-semibold text-stone-800 flex items-center gap-2">
                          <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                            الخيار {index + 1}
                          </span>
                          {option.themeName}
                        </h3>
                        {expandedOptions.includes(index) ? (
                          <ChevronUp className="w-5 h-5 text-stone-500" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-stone-500" />
                        )}
                      </div>
                      
                      <AnimatePresence>
                        {expandedOptions.includes(index) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Days Column */}
                                <div className="space-y-8">
                                  <h4 className="text-lg font-medium text-stone-800 flex items-center gap-2 border-b border-stone-100 pb-2">
                                    <CalendarDays className="w-5 h-5 text-orange-500" />
                                    خطة الـ {duration} أيام
                                  </h4>
                                  <div className="space-y-8">
                                    {option.days.map((day, dIndex) => (
                                      <div key={dIndex} className="bg-stone-50/50 rounded-xl p-4 border border-stone-100">
                                        <h5 className="font-semibold text-orange-700 mb-4">{day.dayOfWeek}</h5>
                                        <div className="space-y-4">
                                          {day.courses.map((course, cIndex) => (
                                            <div key={cIndex} className="relative ps-4 before:content-[''] before:absolute before:start-0 before:top-2 before:bottom-[-1rem] before:w-px before:bg-stone-200 last:before:hidden">
                                              <div className="absolute start-[-3.5px] top-2 w-2 h-2 rounded-full bg-orange-400 ring-4 ring-stone-50" />
                                              <div className="mb-1">
                                                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">{course.courseType}</span>
                                              </div>
                                              <h6 className="text-sm font-medium text-stone-900 mb-1">
                                                {course.recipeName}
                                                {course.calories && (
                                                  <span className="text-xs font-normal text-orange-600 ms-2">
                                                    ({course.calories} سعرة حرارية)
                                                  </span>
                                                )}
                                              </h6>
                                              <p className="text-xs text-stone-600 leading-relaxed mb-2">{course.description}</p>
                                              
                                              <button 
                                                onClick={() => toggleRecipeInstructions(index, dIndex, cIndex, course.recipeName, course.description)}
                                                className="text-xs font-medium text-orange-600 hover:text-orange-700 flex items-center gap-1 transition-colors"
                                              >
                                                <BookOpen className="w-3.5 h-3.5" />
                                                {expandedRecipe === `${index}-${dIndex}-${cIndex}` ? 'إخفاء طريقة التحضير' : 'طريقة التحضير'}
                                              </button>

                                              <AnimatePresence>
                                                {expandedRecipe === `${index}-${dIndex}-${cIndex}` && (
                                                  <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                  >
                                                    <div className="mt-3 p-4 bg-orange-50/50 rounded-xl border border-orange-100">
                                                      {recipeDetails[`${index}-${dIndex}-${cIndex}`]?.loading ? (
                                                        <div className="flex items-center gap-2 text-stone-500 text-xs py-2">
                                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                          جاري تحضير تفاصيل الوصفة...
                                                        </div>
                                                      ) : recipeDetails[`${index}-${dIndex}-${cIndex}`]?.error ? (
                                                        <p className="text-red-500 text-xs">{recipeDetails[`${index}-${dIndex}-${cIndex}`].error}</p>
                                                      ) : (
                                                        <div className="space-y-4">
                                                          <div className="flex flex-wrap gap-4 text-xs text-stone-600 border-b border-orange-200/50 pb-3">
                                                            <span className="flex items-center gap-1.5">
                                                              <Clock className="w-4 h-4 text-orange-500" /> 
                                                              <span className="font-medium">التحضير:</span> {recipeDetails[`${index}-${dIndex}-${cIndex}`]?.prepTime}
                                                            </span>
                                                            <span className="flex items-center gap-1.5">
                                                              <Flame className="w-4 h-4 text-orange-500" /> 
                                                              <span className="font-medium">الطبخ:</span> {recipeDetails[`${index}-${dIndex}-${cIndex}`]?.cookTime}
                                                            </span>
                                                          </div>
                                                          
                                                          <div>
                                                            <h6 className="font-semibold text-stone-800 text-sm mb-2">المكونات:</h6>
                                                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-stone-700">
                                                              {recipeDetails[`${index}-${dIndex}-${cIndex}`]?.ingredients?.map((ing, i) => (
                                                                <li key={i} className="flex items-start gap-1.5">
                                                                  <div className="w-1 h-1 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                                                                  <span>{ing}</span>
                                                                </li>
                                                              ))}
                                                            </ul>
                                                          </div>

                                                          <div>
                                                            <h6 className="font-semibold text-stone-800 text-sm mb-2">طريقة التحضير:</h6>
                                                            <ul className="space-y-2.5">
                                                              {recipeDetails[`${index}-${dIndex}-${cIndex}`]?.steps?.map((step, sIndex) => (
                                                                <li key={sIndex} className="text-xs text-stone-700 flex items-start gap-2">
                                                                  <span className="font-bold text-orange-500 shrink-0 bg-orange-100 w-5 h-5 flex items-center justify-center rounded-full text-[10px]">{sIndex + 1}</span>
                                                                  <span className="pt-0.5 leading-relaxed">{step}</span>
                                                                </li>
                                                              ))}
                                                            </ul>
                                                          </div>

                                                          {recipeDetails[`${index}-${dIndex}-${cIndex}`]?.tips && recipeDetails[`${index}-${dIndex}-${cIndex}`]!.tips!.length > 0 && (
                                                            <div className="bg-orange-100/50 p-3 rounded-lg mt-2 border border-orange-200/50">
                                                              <h6 className="font-semibold text-orange-800 text-xs mb-2 flex items-center gap-1.5">
                                                                <Lightbulb className="w-3.5 h-3.5" /> 
                                                                نصائح إضافية:
                                                              </h6>
                                                              <ul className="space-y-1 text-xs text-orange-900">
                                                                {recipeDetails[`${index}-${dIndex}-${cIndex}`]?.tips?.map((tip, i) => (
                                                                  <li key={i} className="flex items-start gap-1.5">
                                                                    <span className="text-orange-400 mt-0.5">•</span>
                                                                    <span>{tip}</span>
                                                                  </li>
                                                                ))}
                                                              </ul>
                                                            </div>
                                                          )}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </motion.div>
                                                )}
                                              </AnimatePresence>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Grocery List Column */}
                                <div>
                                  <div className="sticky top-24">
                                    <h4 className="text-lg font-medium text-stone-800 flex items-center gap-2 border-b border-stone-100 pb-2 mb-4">
                                      <ShoppingCart className="w-5 h-5 text-orange-500" />
                                      قائمة التسوق الموحدة
                                    </h4>
                                    <div className="bg-orange-50/50 rounded-xl p-5 border border-orange-100 space-y-6">
                                      {option.groceryList.map((aisle, aIndex) => (
                                        <div key={aIndex}>
                                          <h5 className="font-semibold text-stone-800 mb-3 text-sm">{aisle.aisle}</h5>
                                          <ul className="space-y-2">
                                            {aisle.items.map((item, iIndex) => (
                                              <li key={iIndex} className="flex items-start gap-2 text-sm">
                                                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                                                <span className="text-stone-700 font-medium">{item.name}</span>
                                                <span className="text-stone-500 text-xs mt-0.5 ms-auto">{item.quantity}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center h-64 text-stone-400 border-2 border-dashed border-stone-200 rounded-2xl"
                >
                  <ChefHat className="w-12 h-12 mb-4 opacity-20" />
                  <p>Select your meal preferences and generate a plan.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </main>
    </div>
  );
}
