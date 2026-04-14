import { motion } from 'framer-motion';
import { Controller } from 'react-hook-form';

const CareerPathStep = ({ form, onSubmit, onBack, pageVariants }) => {
  const { register, handleSubmit, control, watch, formState: { errors } } = form;

  const careerPaths = [
    { id: 'software_development', label: 'Software Development' },
    { id: 'data_science', label: 'Data Science' },
    { id: 'cybersecurity', label: 'Cybersecurity' },
    { id: 'ux_design', label: 'UX Design' },
    { id: 'product_management', label: 'Product Management' },
    { id: 'digital_marketing', label: 'Digital Marketing' },
  ];

  // Certification options based on career path
  const certificationOptions = {
    software_development: [
      { id: 'aws_developer', label: 'AWS Developer' },
      { id: 'microsoft_azure', label: 'Microsoft Azure' },
      { id: 'google_cloud', label: 'Google Cloud' },
    ],
    data_science: [
      { id: 'tensorflow', label: 'TensorFlow Developer' },
      { id: 'aws_ml', label: 'AWS Machine Learning' },
      { id: 'microsoft_data', label: 'Microsoft Data Analyst' },
    ],
    cybersecurity: [
      { id: 'comptia_security', label: 'CompTIA Security+' },
      { id: 'cissp', label: 'CISSP' },
      { id: 'ceh', label: 'Certified Ethical Hacker' },
    ],
    ux_design: [
      { id: 'google_ux', label: 'Google UX Design' },
      { id: 'nielsen_norman', label: 'Nielsen Norman UX' },
      { id: 'interaction_design', label: 'Interaction Design Foundation' },
    ],
    product_management: [
      { id: 'scrum_product_owner', label: 'Scrum Product Owner' },
      { id: 'product_school', label: 'Product School Certification' },
      { id: 'aipmm', label: 'AIPMM Certification' },
    ],
    digital_marketing: [
      { id: 'google_digital', label: 'Google Digital Marketing' },
      { id: 'facebook_blueprint', label: 'Facebook Blueprint' },
      { id: 'hubspot', label: 'HubSpot Marketing' },
    ],
  };

  const selectedCareerPath = watch('careerPath');

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white">Career Path</h2>
        <p className="text-gray-400 mt-1">Let us know about your career aspirations</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Career Path */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Which career path interests you most?
          </label>
          <div className="grid grid-cols-2 gap-3">
            {careerPaths.map((career) => (
              <label
                key={career.id}
                className={`flex items-center p-3 border ${
                  watch('careerPath') === career.id
                    ? 'border-blue-500 bg-blue-800/30 text-blue-400'
                    : 'border-gray-600 bg-gray-700/30 text-gray-300'
                } rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors`}
              >
                <input
                  type="radio"
                  value={career.id}
                  className="sr-only"
                  {...register('careerPath', { required: "Please select a career path" })}
                />
                <span className="ml-2 text-sm">{career.label}</span>
              </label>
            ))}
          </div>
          {errors.careerPath && (
            <p className="mt-1 text-sm text-red-400">{errors.careerPath.message}</p>
          )}
        </div>

        {/* Experience Level */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            What is your current experience level in this field?
          </label>
          <div className="grid grid-cols-3 gap-2">
            {['beginner', 'intermediate', 'advanced'].map((level) => (
              <label
                key={level}
                className={`flex items-center justify-center px-3 py-2 border ${
                  watch('experienceLevel') === level
                    ? 'border-blue-500 bg-blue-800/30 text-blue-400'
                    : 'border-gray-600 bg-gray-700/30 text-gray-300'
                } rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors`}
              >
                <input
                  type="radio"
                  value={level}
                  className="sr-only"
                  {...register('experienceLevel', { required: "Please select your experience level" })}
                />
                <span className="text-sm capitalize">{level}</span>
              </label>
            ))}
          </div>
          {errors.experienceLevel && (
            <p className="mt-1 text-sm text-red-400">{errors.experienceLevel.message}</p>
          )}
        </div>

        {/* Certifications */}
        {selectedCareerPath && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Which certifications interest you? (Optional)
            </label>
            <Controller
              name="desiredCertifications"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-1 gap-2">
                  {certificationOptions[selectedCareerPath]?.map((cert) => (
                    <label
                      key={cert.id}
                      className={`flex items-center p-3 border ${
                        field.value && field.value.includes(cert.id)
                          ? 'border-blue-500 bg-blue-800/30 text-blue-400'
                          : 'border-gray-600 bg-gray-700/30 text-gray-300'
                      } rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors`}
                    >
                      <input
                        type="checkbox"
                        value={cert.id}
                        checked={field.value && field.value.includes(cert.id)}
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
                      <span className="ml-2 text-sm">{cert.label}</span>
                    </label>
                  ))}
                </div>
              )}
            />
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between pt-4">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Back
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white rounded-lg transition-colors"
          >
            Continue
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default CareerPathStep;