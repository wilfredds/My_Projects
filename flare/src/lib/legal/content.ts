/**
 * About us, Privacy and Terms of Service.
 *
 * This is the client's own wording, transcribed from the design frames. It is
 * kept in the repository rather than in Firestore for two reasons: it changes
 * on legal review, not on a whim, and a privacy notice is a commitment the
 * codebase should be held to — having it in version control means a change to
 * what FLARE promises shows up in a diff.
 *
 * The [INSERT …] markers are the client's own placeholders and are left
 * visible on purpose, so nobody mistakes an unfinished notice for a finished
 * one. They must be filled in before launch.
 */

export type LegalSection = {
  id: string;
  title: string;
  body: string;
};

export const ABOUT_SECTIONS: LegalSection[] = [
  {
    id: "about",
    title: "About us",
    body: `The Firefighters' Learning and Resources Exchange (FLARE) is the official online training platform of the Bureau of Fire Protection (BFP). FLARE provides authorized BFP personnel with a centralized and accessible environment for firefighter education, skills development, and continuous professional learning.

Designed to support the Bureau's training initiatives, FLARE enables firefighters to participate in online courses, complete learning activities, take assessments, and monitor their training progress anytime and anywhere. The platform complements classroom instruction by providing flexible, technology-enabled learning opportunities that help personnel maintain and enhance the competencies required for effective fire service.

## Our mission

To provide and maintain a secure, accessible, and user-friendly online training platform that supports the Bureau of Fire Protection's learning initiatives by delivering up-to-date training content and a reliable digital learning experience for authorized personnel.

## Our vision

To be the Bureau of Fire Protection's trusted online training platform, fostering a competent, well-trained, and future-ready fire service through quality digital learning.

## What FLARE offers

- Online firefighter training courses
- Self-paced learning modules
- Interactive quizzes and assessments
- Training progress tracking
- Course completion certificates (where applicable)
- Multimedia learning resources that support training objectives

## Our commitment

The FLARE team is committed to maintaining a secure, reliable, and user-friendly online training platform for the Bureau of Fire Protection. We continuously enhance the website's functionality, improve its design and user experience, and ensure that training content remains accurate, relevant, and up to date.`,
  },
  {
    id: "privacy",
    title: "Privacy",
    body: `**Privacy Notice — Firefighters' Learning and Resources Exchange (FLARE)**

Effective date: [INSERT DATE]

## 1. Introduction

Welcome to the Firefighters' Learning and Resources Exchange (FLARE), the official Knowledge Management (KM) Portal of the Bureau of Fire Protection (BFP).

The Bureau of Fire Protection is committed to protecting your privacy and ensuring the responsible processing of your personal information in accordance with Republic Act No. 10173, otherwise known as the Data Privacy Act of 2012, its Implementing Rules and Regulations, and issuances of the National Privacy Commission (NPC). This Privacy Notice explains how the BFP collects, uses, stores, shares, and protects your personal information when you access and use FLARE.

## 2. About FLARE

FLARE is the Bureau of Fire Protection's official digital learning and knowledge management platform. It supports the continuous education, professional development, operational readiness, and knowledge sharing of authorized BFP personnel through online courses, training materials, assessments, reference resources, and collaborative learning tools.

## 3. Personal information we collect

To provide and manage FLARE, the BFP may collect and process the following personal information:

- Full name
- Rank
- Badge or employee identification number
- Office, unit, or fire station assignment
- Position or designation
- Official BFP email address
- Official contact number (if applicable)
- User account credentials (encrypted where applicable)
- Course enrollments
- Training progress and completion records
- Assessment and examination results
- Certificates and training achievements
- Login history
- IP address
- Device and browser information
- System usage logs and audit records

Only information necessary for legitimate government purposes is collected.

## 4. Purpose of processing

Your personal information is processed to:

- Verify your identity and authorize access to FLARE
- Create and manage user accounts
- Deliver online learning and training programs
- Record course participation and completion
- Administer examinations and assessments
- Generate certificates and training reports
- Monitor compliance with mandatory BFP training requirements
- Improve learning resources and system performance
- Protect the security and integrity of the Portal
- Detect, investigate, and respond to security incidents

## 5. Your rights as a data subject

Under the Data Privacy Act of 2012, you have the right to be informed, to object, to access, to rectify, to erasure or blocking, to damages, and to data portability, subject to the limits that apply to government records.

## 6. Contact

Data Protection Officer, Bureau of Fire Protection
Email: [INSERT OFFICIAL BFP SUPPORT EMAIL]
Telephone: [INSERT OFFICIAL CONTACT NUMBER]`,
  },
  {
    id: "terms",
    title: "Terms of service",
    body: `**Terms of Service — Firefighters' Learning and Resources Exchange (FLARE)**

Effective date: [INSERT DATE]

## 1. Acceptance of terms

Welcome to the Firefighters' Learning and Resources Exchange (FLARE), the official Knowledge Management (KM) Portal of the Bureau of Fire Protection (BFP).

FLARE is designed to support firefighter education, professional development, operational readiness, and organizational knowledge sharing among authorized BFP personnel.

By accessing or using FLARE, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service, as well as applicable laws of the Republic of the Philippines, BFP policies, and government regulations governing the use of government information and communication technology (ICT) systems.

If you do not agree with these Terms, you must discontinue use of FLARE immediately.

## 2. Portal administration

FLARE is owned, managed, and maintained by the Bureau of Fire Protection (BFP).

The BFP is responsible for:

- Administering user accounts and access permissions
- Maintaining the security, integrity, and availability of the Portal
- Managing training content and learning resources
- Monitoring system usage for operational, audit, and cybersecurity purposes
- Protecting personal information in accordance with applicable laws and government policies
- Implementing updates, maintenance, and enhancements to the Portal

The BFP may designate authorized administrators and personnel to perform these responsibilities on its behalf.`,
  },
];
