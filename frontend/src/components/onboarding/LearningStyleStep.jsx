import { motion } from 'framer-motion';
import { Controller } from 'react-hook-form';

const LearningStyleStep = ({ form, onSubmit, onBack, pageVariants }) => {
  const { register, handleSubmit, control, formState: { errors } } = form;

  const resourceOptions = [
    { id: 'video_courses', label: 'Video Courses' },
    { id: 'interactive_exercises', label: 'Interactive Exercises' },
    { id: 'text_tutorials', label: 'Text Tutorials' },
    { id: 'projects', label: 'Hands-on Projects' },
    { id: 'mentorship', label: 'Mentorship' },
    { id: 'group_learning', label: 'Group Learning' },
  ];

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white">Your Learning Style</h2>
        <p className="text-gray-400 mt-1">Help us tailor the learning experience to your preferences</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Preferred Learning Style */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            How do you learn best?
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'visual', label: 'Visual', description: 'Through images and diagrams' },
              { id: 'auditory', label: 'Auditory', description: 'By listening and discussing' },
              { id: 'reading', label: 'Reading', description: 'Through texts and articles' },
              { id: 'kinesthetic', label: 'Kinesthetic', description: 'By doing and practicing' }
            ].map((style) => (
              <label
                key={style.id}
                className={`flex flex-col items-center p-4 border ${
                  form.watch('preferredStyle') === style.id
                    ? 'border-blue-500 bg-blue-800/30 text-blue-400'
                    : 'border-gray-600 bg-gray-700/30 text-gray-300'
                } rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors`}
              >
                <input
                  type="radio"
                  value={style.id}
                  className="sr-only"
                  {...register('preferredStyle', { required: "Please select your preferred learning style" })}
                />
                <span className="text-sm font-medium">{style.label}</span>
                <span className="block text-xs text-gray-400 text-center mt-1">{style.description}</span>
              </label>
            ))}
          </div>
          {errors.preferredStyle && (
            <p className="mt-1 text-sm text-red-400">{errors.preferredStyle.message}</p>
          )}
        </div>

        {/* Learning Pace */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            What pace do you prefer for learning?
          </label>
          <div className="relative">
            <input
              type="range"
              min="1"
              max="3"
              step="1"
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              {...register('learningPace')}
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Self-paced</span>
              <span>Balanced</span>
              <span>Structured</span>
            </div>
          </div>
        </div>

        {/* Preferred Resources */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            What types of learning resources do you prefer? (Select all that apply)
          </label>
          <Controller
            name="preferredResources"
            control={control}
            rules={{ required: "Please select at least one resource type" }}
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-2">
                {resourceOptions.map((resource) => (
                  <label
                    key={resource.id}
                    className={`flex items-center p-3 border ${
                      field.value && field.value.includes(resource.id)
                        ? 'border-blue-500 bg-blue-800/30 text-blue-400'
                        : 'border-gray-600 bg-gray-700/30 text-gray-300'
                    } rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors`}
                  >
                    <input
                      type="checkbox"
                      value={resource.id}
                      checked={field.value && field.value.includes(resource.id)}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (e.target.checked) {
                          field.onChange([...(field.value || []), value]);
                        } else {
                          field.onChange(field.value.filter(item => item !== value));
                        }
                      }}
                      className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm">{resource.label}</span>
                  </label>
                ))}
              </div>
            )}
          />
          {errors.preferredResources && (
            <p className="mt-1 text-sm text-red-400">{errors.preferredResources.message}</p>
          )}
        </div>

        <div className="pt-4 flex space-x-3">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-2.5 px-4 bg-gray-700 text-gray-300 font-medium rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 transition-all duration-300"
          >
            Back
          </button>
          <button
            type="submit"
            className="flex-1 py-2.5 px-4 bg-gradient-to-r from-purple-500 to-blue-600 text-white font-medium rounded-lg hover:from-purple-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all duration-300"
          >
            Continue
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default LearningStyleStep;