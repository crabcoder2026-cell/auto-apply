import bcrypt from 'bcryptjs';
import {
  createTemplate,
  createUser,
  findUserByEmail,
  getActiveTemplate,
} from '../lib/json-store';

async function main() {
  console.log('Starting seed...');

  const hashedPassword = await bcrypt.hash('johndoe123', 12);

  let testUser = await findUserByEmail('john@doe.com');
  if (!testUser) {
    testUser = await createUser({
      email: 'john@doe.com',
      password: hashedPassword,
      name: 'John Doe',
    });
    console.log('✓ Created test user:', testUser.email);
  } else {
    console.log('✓ Test user already exists:', testUser.email);
  }

  const existingTemplate = await getActiveTemplate(testUser.id);
  if (!existingTemplate) {
    await createTemplate({
      userId: testUser.id,
      fullName: 'John Doe',
      email: 'john@doe.com',
      phone: '+1 (555) 123-4567',
      linkedinUrl: 'https://linkedin.com/in/johndoe',
      portfolioUrl: 'https://johndoe.com',
      currentLocation: 'San Francisco, CA',
      workAuthStatus: 'US Citizen',
      yearsExperience: 5,
      coverLetter:
        'I am writing to express my strong interest in this position. With 5 years of experience in software development and a proven track record of delivering high-quality solutions, I am confident in my ability to contribute to your team.\n\nMy experience includes working with modern web technologies, building scalable applications, and collaborating with cross-functional teams. I am passionate about writing clean, maintainable code and continuously improving my skills.\n\nI look forward to the opportunity to discuss how my experience and skills can benefit your organization.',
      additionalFields: { country: 'United States' },
      resumePath: null,
      resumeFileName: null,
    });
    console.log('✓ Created sample application template for test user');
  } else {
    console.log('✓ Sample template already exists for test user');
  }

  console.log('\nSeed completed successfully!');
  console.log('\nTest Account Credentials:');
  console.log('Email: john@doe.com');
  console.log('Password: johndoe123');
}

main().catch((e) => {
  console.error('Error during seed:', e);
  process.exit(1);
});
