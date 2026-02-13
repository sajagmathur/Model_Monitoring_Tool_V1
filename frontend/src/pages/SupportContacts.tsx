import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { themeClasses } from '../utils/themeClasses';

const SupportContacts: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div className="space-y-8">
      <div>
        <h1 className={`text-4xl font-bold ${themeClasses.textPrimary(theme)} mb-2`}>Support & Contact</h1>
        <p className={themeClasses.textSecondary(theme)}>Get help from our support team and community</p>
      </div>

      <div className="grid gap-6">
        {/* Primary Support */}
        <div className={`${themeClasses.card(theme)} p-6 rounded-lg`}>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary(theme)} mb-4`}>📧 Primary Support Channel</h2>
          <div className={`space-y-3 ${themeClasses.textSecondary(theme)}`}>
            <div>
              <p className={`font-semibold ${themeClasses.textPrimary(theme)}`}>Email Support</p>
              <a href="mailto:support@mlmonitoring.com" className={`underline hover:opacity-80`}>
                support@mlmonitoring.com
              </a>
              <p className="mt-2 text-sm">Response time: Within 2 business hours</p>
            </div>
          </div>
        </div>

        {/* Support Channels */}
        <div className={`${themeClasses.card(theme)} p-6 rounded-lg`}>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary(theme)} mb-4`}>💬 Support Channels</h2>
          <div className={`space-y-4 ${themeClasses.textSecondary(theme)}`}>
            <div>
              <p className={`font-semibold ${themeClasses.textPrimary(theme)}`}>Email</p>
              <p className="text-sm">support@mlmonitoring.com - For general questions and model monitoring issues</p>
              <p className="text-xs opacity-75">Response time: 2 business hours</p>
            </div>
            <div>
              <p className={`font-semibold ${themeClasses.textPrimary(theme)}`}>Chat Support</p>
              <p className="text-sm">Available during business hours (9 AM - 6 PM EST)</p>
              <p className="text-xs opacity-75">Response time: Immediate</p>
            </div>
            <div>
              <p className={`font-semibold ${themeClasses.textPrimary(theme)}`}>Documentation</p>
              <p className="text-sm">Comprehensive guides and troubleshooting available 24/7</p>
              <p className="text-xs opacity-75">Click "Documentation" under the Help (?) menu</p>
            </div>
            <div>
              <p className={`font-semibold ${themeClasses.textPrimary(theme)}`}>Community Forum</p>
              <p className="text-sm">Connect with other users and share solutions</p>
              <p className="text-xs opacity-75">Visit: community.mlmonitoring.com</p>
            </div>
          </div>
        </div>

        {/* Support Levels */}
        <div className={`${themeClasses.card(theme)} p-6 rounded-lg`}>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary(theme)} mb-4`}>🎯 Support Levels</h2>
          <div className={`space-y-4 ${themeClasses.textSecondary(theme)}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${theme === 'dark' ? 'border-white/20' : 'border-gray-300'}`}>
                  <th className={`text-left py-2 ${themeClasses.textPrimary(theme)}`}>Level</th>
                  <th className={`text-left py-2 ${themeClasses.textPrimary(theme)}`}>Response Time</th>
                  <th className={`text-left py-2 ${themeClasses.textPrimary(theme)}`}>Availability</th>
                </tr>
              </thead>
              <tbody>
                <tr className={`border-b ${theme === 'dark' ? 'border-white/20' : 'border-gray-300'}`}>
                  <td className="py-2">Standard</td>
                  <td>2 business hours</td>
                  <td>Business hours</td>
                </tr>
                <tr className={`border-b ${theme === 'dark' ? 'border-white/20' : 'border-gray-300'}`}>
                  <td className="py-2">Priority</td>
                  <td>1 hour</td>
                  <td>Business hours</td>
                </tr>
                <tr>
                  <td className="py-2">Critical</td>
                  <td>15 minutes</td>
                  <td>24/7 On-call</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Specialized Support */}
        <div className={`${themeClasses.card(theme)} p-6 rounded-lg`}>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary(theme)} mb-4`}>👥 Specialized Support Teams</h2>
          <div className={`space-y-3 ${themeClasses.textSecondary(theme)}`}>
            <div>
              <p className={`font-semibold ${themeClasses.textPrimary(theme)}`}>Technical Support</p>
              <p className="text-sm">technical-support@mlops.studio</p>
              <p className="text-xs opacity-75">For bugs, performance issues, and technical integration</p>
            </div>
            <div>
              <p className={`font-semibold ${themeClasses.textPrimary(theme)}`}>Training & Onboarding</p>
              <p className="text-sm">training@mlmonitoring.com</p>
              <p className="text-xs opacity-75">For training sessions, demos, and platform onboarding</p>
            </div>
            <div>
              <p className={`font-semibold ${themeClasses.textPrimary(theme)}`}>Sales & Licensing</p>
              <p className="text-sm">sales@mlmonitoring.com</p>
              <p className="text-xs opacity-75">For pricing, licensing questions, and enterprise inquiries</p>
            </div>
            <div>
              <p className={`font-semibold ${themeClasses.textPrimary(theme)}`}>Model Governance</p>
              <p className="text-sm">governance@mlmonitoring.com</p>
              <p className="text-xs opacity-75">For model governance, compliance, and risk management support</p>
            </div>
          </div>
        </div>

        {/* Common Issues */}
        <div className={`${themeClasses.card(theme)} p-6 rounded-lg`}>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary(theme)} mb-4`}>❓ Quick Help for Common Issues</h2>
          <div className={`space-y-3 ${themeClasses.textSecondary(theme)}`}>
            <div>
              <p className={`font-semibold ${themeClasses.textPrimary(theme)}`}>Model Monitoring Issues?</p>
              <p className="text-sm ml-2">Check model registry for version tracking and governance requirements. Review monitoring dashboard for drift detection.</p>
            </div>
            <div>
              <p className={`font-semibold ${themeClasses.textPrimary(theme)}`}>Compliance & Audit?</p>
              <p className="text-sm ml-2">Review audit logs and fairness metrics. Check approval workflows for model promotion.</p>
            </div>
            <div>
              <p className={`font-semibold ${themeClasses.textPrimary(theme)}`}>Data drift detected?</p>
              <p className="text-sm ml-2">Verify data quality metrics and PSI values. Contact Data Engineering team for investigation.</p>
            </div>
            <div>
              <p className={`font-semibold ${themeClasses.textPrimary(theme)}`}>Performance degradation?</p>
              <p className="text-sm ml-2">Check model performance metrics and retraining triggers. Review production environment stability.</p>
            </div>
            <div className={`mt-4 p-3 rounded ${theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
              <p className="text-sm">💡 <strong>Tip:</strong> Check the Documentation tab for comprehensive guides before contacting support.</p>
            </div>
          </div>
        </div>

        {/* SLA & Response */}
        <div className={`${themeClasses.card(theme)} p-6 rounded-lg`}>
          <h2 className={`text-2xl font-bold ${themeClasses.textPrimary(theme)} mb-4`}>📋 Support SLA & Response Times</h2>
          <div className={`space-y-3 ${themeClasses.textSecondary(theme)}`}>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Standard support: Response within 2 business hours</li>
              <li>Priority issues: Response within 1 hour during business hours</li>
              <li>Critical outages: 24/7 on-call team, response within 15 minutes</li>
              <li>Feature requests: Reviewed within 5 business days</li>
              <li>Bug reports: Confirmed within 1 business day</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportContacts;
