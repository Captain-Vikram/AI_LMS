import { motion } from 'framer-motion';
import { Controller } from 'react-hook-form';

const GoalSettingStep = ({ form, onSubmit, pageVariants }) => {
  const { register, handleSubmit, control, formState: { errors, isValid } } = form;

  const prioritySkillOptions = [
    { id: 'deep_learning', label: 'Deep Learning' },
    { id: 'design', label: 'Design' },
    { id: 'business', label: 'Business' },
    { id: 'communication', label: 'Communication' },
    { id: 'data_science', label: 'Data Science' },
    { id: 'leadership', label: 'Leadership' },
    { id: 'marketing', label: 'Marketing' },
  ];

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white">Set Your Learning Goals</h2>
        <p className="text-gray-400 mt-1">Tell us what you want to achieve on your learning journey</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Primary Goal */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            What is your primary learning goal?
          </label>
          <select
            className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            {...register("primaryGoal", { required: "Please select your primary goal" })}
          >
            <option value="" disabled>Select your primary goal</option>
            <option value="career_advancement">Career Advancement</option>
            <option value="new_skills">Learn New Skills</option>
            <option value="certification">Get Certified</option>
            <option value="career_change">Change Career Path</option>
            <option value="personal_growth">Personal Growth</option>
          </select>
          {errors.primaryGoal && (
            <p className="mt-1 text-sm text-red-400">{errors.primaryGoal.message}</p>
          )}
        </div>

        {/* Time Commitment */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            How much time can you commit each week?
          </label>
          <div className="grid grid-cols-3 gap-3">
            {['minimal', 'moderate', 'intensive'].map((option) => (
              <label
                key={option}
                className={`flex items-center justify-center px-3 py-2 border ${
                  form.watch('timeCommitment') === option
                    ? 'border-blue-500 bg-blue-800/30 text-blue-400'
                    : 'border-gray-600 bg-gray-700/30 text-gray-300'
                } rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors`}
              >
                <input
                  type="radio"
                  value={option}
                  className="sr-only"
                  {...register('timeCommitment', { required: true })}
                />
                <span className="text-sm capitalize">{option}</span>
                <span className="block text-xs text-gray-400 mt-1">
                  {option === 'minimal' && '1-3 hours'}
                  {option === 'moderate' && '4-7 hours'}
                  {option === 'intensive' && '8+ hours'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Priority Skills */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Which skills are most important to you? (Select up to 3)
          </label>
          <Controller
            name="prioritySkills"
            control={control}
            rules={{ 
              validate: value => 
                !value || value.length <= 3 || "Please select no more than 3 skills"
            }}
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {prioritySkillOptions.map((skill) => (
                  <label
                    key={skill.id}
                    className={`flex items-center p-3 border ${
                      field.value && field.value.includes(skill.id)
                        ? 'border-blue-500 bg-blue-800/30 text-blue-400'
                        : 'border-gray-600 bg-gray-700/30 text-gray-300'
                    } rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors`}
                  >
                    <input
                      type="checkbox"
                      value={skill.id}
                      checked={field.value && field.value.includes(skill.id)}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (e.target.checked) {
                          if (!field.value) {
                            field.onChange([value]);
                          } else if (field.value.length < 3) {
                            field.onChange([...field.value, value]);
                          }
                        } else {
                          field.onChange(field.value.filter(item => item !== value));
                        }
                      }}
                      className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm">{skill.label}</span>
                  </label>
                ))}
              </div>
            )}
          />
          {errors.prioritySkills && (
            <p className="mt-1 text-sm text-red-400">{errors.prioritySkills.message}</p>
          )}
        </div>

        <div className="pt-4">
          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-500 to-blue-600 text-white font-medium rounded-lg hover:from-purple-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-300"
          >
            Continue
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default GoalSettingStep;