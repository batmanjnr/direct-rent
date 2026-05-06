import { Listing } from './types';

export const FEATURED_LISTINGS: Listing[] = [
  {
    id: 1,
    title: "Premium Self-Contain Unit",
    price: "₦350,000",
    priceValue: 350000,
    location: "Agbowo, UI",
    type: "Self-Contain",
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1554995207-c18c20360a59?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80"
    ],
    verified: true,
    noFee: true,
    beds: 1,
    baths: 1,
    area: "45 SQM",
    amenities: ["Water", "Security", "Prepaid Meter"],
    landmark: "5 mins from UI Gate",
    isRecentlyAdded: true,
    agent: { 
      id: "agent_kunle", 
      name: "Kunle Ajayi", 
      rating: 4.8, 
      isVerified: true,
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80" 
    },
    isFavorite: false
  },
  {
    id: 2,
    title: "Modern 1-Bedroom Flat",
    price: "₦550,000",
    priceValue: 550000,
    location: "Bodija",
    type: "1 Bedroom Flat",
    image: "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=800",
    images: [
      "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/1571458/pexels-photo-1571458.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/1571468/pexels-photo-1571468.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=800&q=80"
    ],
    verified: true,
    noFee: false,
    beds: 1,
    baths: 1,
    area: "65 SQM",
    amenities: ["Solar", "Security", "Parking"],
    landmark: "Near Bodija Market",
    slotsLeft: 2,
    agent: { 
      id: "agent_sarah", 
      name: "Sarah Bolanle", 
      rating: 4.5, 
      isVerified: true,
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80"
    },
    isFavorite: true
  },
  {
    id: 3,
    title: "Spacious Shared Apartment",
    price: "₦180,000",
    priceValue: 180000,
    location: "Akobo",
    type: "Shared",
    image: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1560185127-6a430ae16cb0?auto=format&fit=crop&w=800&q=80",
      "https://images.pexels.com/photos/276724/pexels-photo-276724.jpeg?auto=compress&cs=tinysrgb&w=800"
    ],
    verified: true,
    noFee: true,
    beds: 2,
    baths: 2,
    area: "120 SQM",
    amenities: ["Water", "Security"],
    landmark: "Close to General Gas",
    isRecentlyAdded: true,
    agent: { 
      id: "agent_mike", 
      name: "Olawale Mike", 
      rating: 4.2, 
      isVerified: false,
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80"
    },
    isFavorite: false
  },
  {
    id: 4,
    title: "Executive 1-Bedroom Apartment",
    price: "₦750,000",
    priceValue: 750000,
    location: "Jericho",
    type: "1 Bedroom Flat",
    image: "https://images.pexels.com/photos/276528/pexels-photo-276528.jpeg?auto=compress&cs=tinysrgb&w=800",
    images: [
      "https://images.pexels.com/photos/276528/pexels-photo-276528.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/2724749/pexels-photo-2724749.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.unsplash.com/photo-1616047006789-b7af5afb8c20?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1615876234886-fd9a39f65c92?auto=format&fit=crop&w=800&q=80"
    ],
    verified: true,
    noFee: false,
    beds: 1,
    baths: 1,
    area: "80 SQM",
    amenities: ["Generator", "AC", "Security"],
    landmark: "Near Jericho Mall",
    isRecentlyAdded: false,
    agent: { 
      id: "agent_bose", 
      name: "Bose Adeniran", 
      rating: 4.9, 
      isVerified: true,
      avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80"
    },
    isFavorite: false
  },
  {
    id: 5,
    title: "Cozy Student Self-Contain",
    price: "₦250,000",
    priceValue: 250000,
    location: "Samonda",
    type: "Self-Contain",
    image: "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1556912170-454612e47573?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1618221195710-dd6b41faeaa6?auto=format&fit=crop&w=800&q=80",
      "https://images.pexels.com/photos/1571470/pexels-photo-1571470.jpeg?auto=compress&cs=tinysrgb&w=800"
    ],
    verified: false,
    noFee: true,
    beds: 1,
    baths: 1,
    area: "40 SQM",
    amenities: ["Water", "Fenced"],
    landmark: "Walking distance to UI",
    isRecentlyAdded: true,
    agent: { 
      id: "agent_ibrahim", 
      name: "Ibrahim Lawal", 
      rating: 3.8, 
      isVerified: false,
      avatarUrl: "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?auto=format&fit=crop&w=150&q=80"
    },
    isFavorite: false
  },
  {
    id: 6,
    title: "Newly Built 1-Bedroom Flat",
    price: "₦600,000",
    priceValue: 600000,
    location: "Oluyole",
    type: "1 Bedroom Flat",
    image: "https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=800",
    images: [
      "https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=800&q=80",
      "https://images.pexels.com/photos/279719/pexels-photo-279719.jpeg?auto=compress&cs=tinysrgb&w=800"
    ],
    verified: true,
    noFee: false,
    beds: 1,
    baths: 1,
    area: "70 SQM",
    amenities: ["Security", "Clean Water", "Parking"],
    landmark: "Behind Ring Road State Hospital",
    slotsLeft: 1,
    agent: { 
      id: "agent_janet", 
      name: "Janet Ade", 
      rating: 4.7, 
      isVerified: true,
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
    },
    isFavorite: false
  },
  {
    id: 7,
    title: "Budget Shared Living",
    price: "₦120,000",
    priceValue: 120000,
    location: "Apata",
    type: "Shared",
    image: "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1560411235-46f90117b3f9?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1616137422495-1e9e46e2aa77?auto=format&fit=crop&w=800&q=80",
      "https://images.pexels.com/photos/271639/pexels-photo-271639.jpeg?auto=compress&cs=tinysrgb&w=800"
    ],
    verified: false,
    noFee: true,
    beds: 3,
    baths: 2,
    area: "140 SQM",
    amenities: ["Water", "Spacious Kitchen"],
    landmark: "Near NNPC Depot",
    isRecentlyAdded: false,
    agent: { 
      id: "agent_samuel", 
      name: "Samuel Okon", 
      rating: 4.0, 
      isVerified: false,
      avatarUrl: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=150&q=80"
    },
    isFavorite: false
  },
  {
    id: 8,
    title: "Luxury Self-Contain Studio",
    price: "₦450,000",
    priceValue: 450000,
    location: "Ikolaba",
    type: "Self-Contain",
    image: "https://images.pexels.com/photos/1571453/pexels-photo-1571453.jpeg?auto=compress&cs=tinysrgb&w=800",
    images: [
      "https://images.pexels.com/photos/1571453/pexels-photo-1571453.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.unsplash.com/photo-1556020685-ae41abfc936c?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1512918728675-ed5a9ecde9d3?auto=format&fit=crop&w=800&q=80",
      "https://images.pexels.com/photos/271647/pexels-photo-271647.jpeg?auto=compress&cs=tinysrgb&w=800"
    ],
    verified: true,
    noFee: true,
    beds: 1,
    baths: 1,
    area: "50 SQM",
    amenities: ["AC", "Swimming Pool", "Gym"],
    landmark: "Behind Custom Office",
    isRecentlyAdded: true,
    agent: { 
      id: "agent_kunle", 
      name: "Kunle Ajayi", 
      rating: 4.8, 
      isVerified: true,
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80"
    },
    isFavorite: true
  },
  {
    id: 9,
    title: "Comfortable 1-Bedroom Flat",
    price: "₦400,000",
    priceValue: 400000,
    location: "Ologuneru",
    type: "1 Bedroom Flat",
    image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1616594197247-b695b0902274?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1617103996702-96ff29b1c467?auto=format&fit=crop&w=800&q=80",
      "https://images.pexels.com/photos/210265/pexels-photo-210265.jpeg?auto=compress&cs=tinysrgb&w=800"
    ],
    verified: true,
    noFee: false,
    beds: 1,
    baths: 1,
    area: "60 SQM",
    amenities: ["Steady Water", "Secured Gate"],
    landmark: "Close to Eleyele",
    isRecentlyAdded: false,
    agent: { 
      id: "agent_sarah", 
      name: "Sarah Bolanle", 
      rating: 4.5, 
      isVerified: true,
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80"
    },
    isFavorite: false
  },
  {
    id: 10,
    title: "Premium Hostel Room",
    price: "₦150,000",
    priceValue: 150000,
    location: "Under G, Lautech",
    type: "Self-Contain",
    image: "https://images.pexels.com/photos/279719/pexels-photo-279719.jpeg?auto=compress&cs=tinysrgb&w=800",
    images: [
      "https://images.pexels.com/photos/279719/pexels-photo-279719.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.unsplash.com/photo-1513584684374-8bdb74838a0f?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80",
      "https://images.pexels.com/photos/275484/pexels-photo-275484.jpeg?auto=compress&cs=tinysrgb&w=800"
    ],
    verified: true,
    noFee: true,
    beds: 1,
    baths: 1,
    area: "30 SQM",
    amenities: ["Generator", "Water", "Security"],
    landmark: "2 mins from Under G Gate",
    isRecentlyAdded: true,
    slotsLeft: 3,
    agent: { 
      id: "agent_tayo", 
      name: "Tayo O.", 
      rating: 4.6, 
      isVerified: true,
      avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80"
    },
    isFavorite: false
  },
  {
    id: 11,
    title: "Off-Campus 1-Bedroom",
    price: "₦280,000",
    priceValue: 280000,
    location: "Adenike, Ogbomoso",
    type: "1 Bedroom Flat",
    image: "https://images.pexels.com/photos/545012/pexels-photo-545012.jpeg?auto=compress&cs=tinysrgb&w=800",
    images: [
      "https://images.pexels.com/photos/545012/pexels-photo-545012.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1616047006789-b7af5afb8c20?auto=format&fit=crop&w=800&q=80",
      "https://images.pexels.com/photos/1571459/pexels-photo-1571459.jpeg?auto=compress&cs=tinysrgb&w=800"
    ],
    verified: false,
    noFee: false,
    beds: 1,
    baths: 1,
    area: "55 SQM",
    amenities: ["Well Water", "Fenced"],
    landmark: "Near Adenike Area",
    isRecentlyAdded: false,
    agent: { 
      id: "agent_moses", 
      name: "Moses Adewale", 
      rating: 4.1, 
      isVerified: false,
      avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80"
    },
    isFavorite: false
  },
  {
    id: 12,
    title: "Standard Shared Room",
    price: "₦80,000",
    priceValue: 80000,
    location: "Stadium Area, Ogbomoso",
    type: "Shared",
    image: "https://images.pexels.com/photos/271639/pexels-photo-271639.jpeg?auto=compress&cs=tinysrgb&w=800",
    images: [
      "https://images.pexels.com/photos/271639/pexels-photo-271639.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.unsplash.com/photo-1594333120323-8190279193EF?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1615873966183-f25211831c7f?auto=format&fit=crop&w=800&q=80",
      "https://images.pexels.com/photos/271649/pexels-photo-271649.jpeg?auto=compress&cs=tinysrgb&w=800"
    ],
    verified: true,
    noFee: true,
    beds: 2,
    baths: 1,
    area: "35 SQM",
    amenities: ["Reading Table", "Fan"],
    landmark: "Very close to Lautech Stadium",
    isRecentlyAdded: true,
    agent: { 
      id: "agent_comfort", 
      name: "Comfort I.", 
      rating: 4.4, 
      isVerified: true,
      avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80"
    },
    isFavorite: false
  }
];

// NOTE: This file exports sample listing data. Because it's located under `app/`, expo-router
// treats it as a route file and expects a default React component. To avoid changing the
// project structure, export a harmless default component. For a cleaner fix move this file
// to a non-route folder (e.g. `lib/data.ts`).
import React from 'react';

export default function DataRoute() {
  return null;
}
