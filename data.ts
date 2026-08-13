import { User, Module, Role } from './types';

export const LIKERT_QUESTIONS = [
    "The instructor explained the concepts clearly.",
    "The instructor demonstrated in-depth knowledge of the subject.",
    "The instructor was punctual and utilized class time effectively.",
    "The course materials/resources provided were helpful.",
    "Assignments and assessments were relevant to the course objectives.",
    "The instructor encouraged questions and participation.",
    "The pace of the course was appropriate.",
    "Real-world applications/examples were used to explain concepts.",
    "The instructor was available for support outside of class hours.",
    "Overall, I am satisfied with this module."
];

export const CAMPUS_LIKERT_QUESTIONS = [
    "I feel safe and secure on campus.",
    "The campus facilities (library, labs, restrooms) are well-maintained.",
    "The administrative staff is helpful and approachable.",
    "There are sufficient extracurricular activities and events.",
    "Overall, I am satisfied with my experience at the college."
];

export const CAMPUS_FEEDBACK_CODE = 'GENERAL_CAMPUS_FEEDBACK';

export const normalizeProgram = (p: string) => p ? p.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '') : '';

// Helper to get YYYY-MM-DD string in LOCAL TIME (fixing UTC/IST offset issues)
export const getLocalDateString = (date: Date = new Date()): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const getHodDepartments = (hodId: string): string[] => {
    // Mapping HOD IDs to departments based on provided faculty data
    const map: Record<string, string[]> = {
        'BLR002': ['interior'], // Revathy E S
        'BLR003': ['graphics'], // Sugumar Gowtham
        'BLR006': ['animation'], // Sunil PN
        'BLR009': ['game'], // Sandeep S Anand
        'BLR016': ['ui'], // Sandeep Chakravarthy
        'BLR018': ['photography'], // Nirmal Kumar M
        'BLR021': ['visualeffects'], // Jishnu N K
        'BLR024': ['multimedia'], // John William Carey J
        'BLR026': ['foundation'], // DRAO (Education Manager acting as HOD for Foundation)
    };
    return map[hodId] || [];
};

export interface Room {
    id: string;
    number: string;
    name: string;
    capacity: number;
    floor: number;
    allocatedDepartment?: string;
}

const ROOMS_CSV = `Floor No,ROOM NUMBER'S,ROOM NAME,ROOM CAPACITY
2,201,LAB,36
2,202,CLASSROOM,25
2,204,CLASSROOM,28
2,205,CLASSROOM,35
2,206,LAB,10
2,207,CLASSROOM,10
2,208,LAB,18
3,301,FASHION LAB 1,15
3,302,,15
3,303,LAB,20
3,304,LAB,20
3,305,CLASSROOM,35
3,306,CLASSROOM,30
3,307,CLASSROOM,16
4,401 A,LAB,10
4,401 B,LAB,15
4,402,LAB,20
4,403,LAB,20
4,404,LAB / CLASS ROOM,20
4,406,LAB,20
4,407,CLASSROOM,20
4,408,CLASSROOM,16
5,501_A,CLASSROOM,35
5,501_B,CLASSROOM,15
5,503,CLASSROOM,30`;

export const parseRooms = (): Room[] => {
    const lines = ROOMS_CSV.split('\n');
    const rooms: Room[] = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',');
        if (cols.length < 4) continue;
        const floor = parseInt(cols[0]) || 0;
        const number = cols[1]?.trim();
        const name = cols[2]?.trim() || `Room ${number}`;
        const capacity = parseInt(cols[3]) || 0;
        rooms.push({ id: number, number, name, capacity, floor });
    }
    return rooms;
};

const FACULTY_CSV = `Employee ID,Faculty Members,Specializations,E mail,Role
BLR001,Monisha k,Interior Design,monisha.k@icat.ac.in,Tutor
BLR002,Revathy E S,Interior Design,revathy.es@icat.ac.in,HOD
BLR003,Sugumar Gowtham Thamotharapandian,Graphic Design,sugumar.gowtham@icat.ac.in,HOD
BLR004,Riya Premanand Gaonker,Graphic Design,riya.gaonker@icat.ac.in,Tutor
BLR005,Abhishek Reddy,Graphic Design,abhishek.r@icat.ac.in,Tutor
BLR006,Sunil PN,Animation,sunil.pn@icat.ac.in,HOD
BLR007,Sharan Kumar Ramagouda,Animation,sharan.r@icat.ac.in,Tutor
BLR008,Akhil Shaji,Animation,akhil.shaji@icat.ac.in,Tutor
BLR009,Sandeep S Anand,Game Design,sandeep.s@icat.ac.in,HOD
BLR010,Pranav AS,Game Design,pranav.as@icat.ac.in,Tutor
BLR011,Sachin,Game Design,sachin@icat.ac.in,Tutor
BLR012,Roja R,Game Design,roja.r@icat.ac.in,Tutor
BLR013,Jibin Geeson,Game Design,jibin.g@icat.ac.in,Tutor
BLR014,Mandala Puneeth Naidu,Game Design,puneeth.m@icat.ac.in,Tutor
BLR015,Tapan Kumar Roy,Game Design,tapan.r@icat.ac.in,Tutor
BLR016,Sandeep Chakravarthy H M,UI/UX,sandeep.hm@icat.ac.in,HOD
BLR017,Kamran Haider,UI/UX,kamran.haider@icat.ac.in,Tutor
BLR018,Nirmal Kumar M,Photography,nirmalkumar.m@icat.ac.in,HOD
BLR019,Karthik A Hegde,Photography,karthik.a@icat.ac.in,Tutor
BLR020,Nagalakshmi N,Fashion Design,nagalakshmi.n@icat.ac.in,Tutor
BLR021,Jishnu N K,Visual Effects,jishnu.nk@icat.ac.in,HOD
BLR022,Lalu v,Visual Effects,lalu.v@icat.ac.in,Tutor
BLR023,Pradeep P,Multimedia,pradeep.p@icat.ac.in,Tutor
BLR024,John William Carey J,Multimedia,john.william@icat.ac.in,HOD
BLR025,Shikhar Khatri,Photography,shikhar.k@icat.ac.in,Tutor
BLR026,Rajeev AG,Administration,drao.blr@icat.ac.in,Education Manager
BLR027,Dr. Sudheshna Das,Administration,viceprincipal.blr@icat.ac.in,Education Manager
BLR028,S.Hemachandran,Administration,hemachandran@icat.ac.in,System Administrator
BLR029,Pradeepa H,Administration,pradeepa.h@icat.ac.in,Student Service
BLR030,Shreyas Kumar,Administration,shreyas@imageil.com,Student Service
BLR031,Hema Nanjappa P,Administration,hema.nanjappa@icat.ac.in,Student Service
BLR032,Praveen K,Administration,praveen.k@icat.ac.in,Student Service`;

const STUDENT_CSV = `College ID,Name,Program ID,Year,Mail id,Role
2025UG05015,KETHIREDDY BHAVITHA,BSc Fashion and Apparel Design,1,bhavithakethireddy@gmail.com,Student
2025UG05006,Lekha. S,BSc Fashion and Apparel Design,1,shivalekha78@gmail.com,Student
2025UG05012,Moubani Nayak,BSc Fashion and Apparel Design,1,nayak.mou2003@gmail.com,Student
2025UG05001,Vaishali M.K,BSc Fashion and Apparel Design,1,vaishalinaren47@gmail.com,Student
2025UG05016,Vanam Nithin Datta,BSc Fashion and Apparel Design,1,vanamnithinabd17@gmail.com,Student
2025UG05011,Ahammed Nihal v,BVA Animation and Game Art,1,nihalvadakkan7@gmail.com,Student
2025UG05005,A FREDRICK ROSHAN ,BVA Animation and Game Art,1,Fredyrosh6@gmail.com,Student
2025UG05004,Fredrick fernando,BVA Animation and Game Art,1,Fredifdo2007@gmail.com,Student
2025UG05013,Nikitha suthar,BVA Animation and Game Art,1,nikithasutharsuthar@gmail.com,Student
2025UG05010,RANEEM MOHAMED K,BVA Animation and Game Art,1,mohdraneem065@gmail.com,Student
2025UG05008,Ayush Dhar,BVA Graphics and Communication Design,1,ayushdhar64@gmail.com,Student
2025UG05002,Boggarapu Hansitha,BVA Graphics and Communication Design,1,hansiboggarapu@gmail.com,Student
2025UG05009,Swathi N salimath,BVA Graphics and Communication Design,1,swathisalimath617@gmail.com,Student
2025UG05003,Vineet karari,BVA Graphics and Communication Design,1,Kararivineet@gmail.com,Student
2025UG05017,Vivin Arora,BVA Graphics and Communication Design,1,vivinarora5717@gmail.com,Student
2025UG05018,Joyal Bernold N,BVA Graphics and Communication Design,1,richardjoyal9380@gmail.com,Student
2025UG06013,Agnibhu Mitra,BSc Game Design & Development,1,agnihero2006@gmail.com,Student
2025UG06091,Harikrishna Vlavil Sunil,BSc Game Design & Development,1,thehar4017m@gmail.com,Student
2025UG06046,Niraj Rai,BSc Game Design & Development,1,nirajrai200617@gmail.com,Student
2025UG06023,Bihan Kar Choudhury,BSc Game Design & Development,1,bihanrio2007@gmail.com,Student
2025UG06054,Dharan M,BSc Game Design & Development,1,dharan2028@gmail.com,Student
2025UG06022,Joshua Praveen Selvaraj J,BSc Game Design & Development,1,joshuaselvaraj08@gmail.com,Student
2025UG06070,Joshua Samuel Singh,BSc Game Design & Development,1,joshuasamuel1325@gmail.com,Student
2025UG06099,Kishan D Yadav,BSc Game Design & Development,1,Lookiezzurstylematters@gmail.com,Student
2025UG06008,Oliver L,BSc Game Design & Development,1,olivermcl2007@gmail.com,Student
2025UG06102,Pratyush Panicker,BSc Game Design & Development,1,panickerpratyush@gmail.com,Student
2025UG06087,CHINTAPATLA SRI SAI CHARAN,BSc Media Technology,1,charanchintapatla23@gmail.com,Student
2025UG06009,Deepthi Hari,BSc Media Technology,1,deepthihari08@gmail.com,Student
2025UG06075,Katil Abhijeet Jitesh,BSc Media Technology,1,abhijeetkatil@gmail.com,Student
2025UG06078,Mukkamalla Harshavardhan Reddy,BSc Media Technology,1,mukkamallaharshareddy16@gmail.com,Student
2025UG06014,Saahil Khan,BSc Media Technology,1,khan.saahil2120@gmail.com,Student
2024UG06046,ABHINEETH MENON ,BSc Game Art & Design,2,abhineethmenon2006@gmail.com,Student
2024UG06013,ABIJIT A,BSc Game Art & Design,2,abijitajaykhosh@gmail.com,Student
2024UG06039,Aditya Rishu ,BSc Game Art & Design,2,aditya.rishu11@gmail.com,Student
2024UG06054,AMARAPINNI VASDEV,BSc Game Art & Design,2,amarapinni.vasdev@gmail.com,Student
2024UG06051,Avilash Das,BSc Game Art & Design,2,avilashdas2006@gmail.com,Student
2024UG06126,G Hrishikesh,BSc Game Art & Design,2,hrishikesh202005@gmail.com,Student
2024UG06097,Yakasiri Suresh,BSc Game Art & Design,2,sureshyakasiri2004@gmail.com,Student
2024UG06068,Advaith Santhosh,BSc Game Design & Development,2,santhoshadvaith10@gmail.com,Student
2024UG06010,Gokul Krishnan ,BSc Game Design & Development,2,gk6761394@gmail.com,Student
2024UG06108,Jagadeesan.M,BSc Game Design & Development,2,jagadeesanmello@gmail.com,Student
2024UG06019,Mubeen M,BSc Game Design & Development,2,mubeenm2005@gmail.com,Student
2024UG06088,Muhammed Saahil M Shias,BSc Game Design & Development,2,Saahilem@gmail.com,Student
2024UG06104,Rishi Raavan Reddy Bommareddy,BSc Game Design & Development,2,rishiraavan@gmail.com,Student
2024UG06014,Shaik imam saheb,BSc Game Design & Development,2,imamsaheb997@gmail.com,Student
2024UG06056,Arjun K,BSc Media Technology,2,aarjun26310@gmail.com,Student
2024UG06086,ASHIEL JOSEPH A T,BSc Media Technology,2,ashieljoseph14@gmail.com,Student
2024UG06143,Jyothi Krishna,BSc Media Technology,2,jyothikrishnapsy911@gmail.com ,Student
2024UG06123,Md. Afzal Ahmed Choudhury,BSc Media Technology,2,sein85856009@gmail.com,Student
2024UG06012,S HARIGOVIND,BSc Media Technology,2,harigovinds995@gmail.com,Student
2024UG06089,SANADUL SINAN,BSc Media Technology,2,sinansanadul@gmail.com,Student
2024UG06139,UDITH S M,BSc Media Technology,2,udithsm2005@gmail.com,Student
2024UG06153,M Chandu Prakash,BSc Media Technology,2,yuvaprasad307@gmail.com,Student
2024UG06075,Jayanth L R,BSc Photography,2,jayanth81485@gmail.com,Student
2024UG06061,Monish M Reddy ,BSc Photography,2,monishmreddy123@gmail.com,Student
2024UG06131,Nuthendra ,BSc Photography,2,Nuthendra7128@gmail.com,Student
2024UG06148,Nyathappa Gari Girish ,BSc Photography,2,bngirishajay143@gmail.com,Student
2024UG06074,Shakti j,BSc Photography,2,shakthi412006@gmail.com,Student
2023UG06142,Michal biju,BSc Photography,2,Michalbiju11@gmail.com,Student
2024UG06110,ABHISHEK PK,BSc UI/UX Design,2,aabhi224941@gmail.com,Student
2024UG06111,ADITHYAN PK,BSc UI/UX Design,2,adithyanpk587@gmail.com,Student
2024UG06109,Jain Khushi Sumit,BSc UI/UX Design,2,janvij2606@gmail.com,Student
2024UG06146,NIRMAL MATHEW,BSc UI/UX Design,2,nirmalmathewbaby@gmail.com,Student
2024UG06055,SAUMYA,BSc UI/UX Design,2,Saumyatia1@gmail.com,Student
2024UG06116,Shreyas S,BSc UI/UX Design,2,Shreyas1707ga@gmail.com,Student
2024UG06065,AKHIL A K,BSc Visual Effects,2,akhil32523@gmail.com ,Student
2024UG06072,Devadathan M,BSc Visual Effects,2,d3vadathan@gmail.com,Student
2024UG06127,Eamon Duron Xavier Almeida ,BSc Visual Effects,2,eamonalmeida67@gmail.com,Student
2024UG06011,Sayed konain pasha ,BSc Visual Effects,2,konainpashashop@gmail.com,Student
2024UG05001,ABHISHEK REUBEN KOSHY,BVA Animation and Game Art,2,arkoshy006@gmail.com,Student
2024UG05027,Anujna B Rao,BVA Animation and Game Art,2,anujnabrao@gmail.com,Student
2024UG05005,Ayush Singh,BVA Animation and Game Art,2,singhbro1001@gmail.com,Student
2024UGU5021,Gregary Santhosh ,BVA Animation and Game Art,2,gregarysanthosh25@gmail.com,Student
2024UG05010,Hostin Alexander Gonsalves,BVA Animation and Game Art,2,hostingonsalves93@gmail.com,Student
2024UG05019,I.Kunal,BVA Animation and Game Art,2,kunalmj581@gmail.com,Student
2024UG05022,Mirigang Biswajit Das,BVA Animation and Game Art,2,mrigangdas2212@gmail.com,Student
2024UG05011,Mohandass,BVA Animation and Game Art,2,mohandassethurasu@gmail.com,Student
2024UG05018,Mrinal Das,BVA Animation and Game Art,2,rd692739@gmail.com,Student
2024UG05017,Rahul Robin ,BVA Animation and Game Art,2,rahulrobin18@gmail.com,Student
2024UG05020,Rahunath,BVA Animation and Game Art,2,rahunath.sm@gmail.com,Student
2024UG05009,Rohnit Prabhraj,BVA Animation and Game Art,2,rohnit919@gmail.com,Student
2024UG05002,SIDDHARTH SHARMA,BVA Animation and Game Art,2,sidd2k20@gmail.com,Student
2024UG05029,Nikesh,BVA Animation and Game Art,2,nikesh11315@gmail.com,Student
2024UG05024,S.Surya Narayana ,BVA Animation and Game Art,2,suryanarayana282006@gmail.com,Student
2024UG05007,B.Tejas,BVA Graphics and Communication Design,2,btejas1010@gmail.com,Student
2024UG05016,Abhyud Therayil,BVA Graphics and Communication Design,2,abhyudtherayil@gmail.com,Student
2024UG05030,Hisham Haneef,BVA Graphics and Communication Design,2,hishamhaneef900@gmail.com,Student
2024UG05004,NEYA. B,BVA Graphics and Communication Design,2,neyabaskar2006@gmail.com,Student
2024UG05012,Niyam Brijesh Sheth,BVA Graphics and Communication Design,2,niyamsheth@gmail.com,Student
2024UG05014,Rithuparnan P S,BVA Graphics and Communication Design,2,rithuparnanpss@gmail.com,Student
2024UG05006,Sristi Saha,BVA Graphics and Communication Design,2,sahasristi21@gmail.com,Student
2024UG05028,Bhavishya R Reddy ,BVA Interior and Spatial Design,2,bhavishyareddy2004@gmail.com,Student
2024UG05026,Gopikka Gopalakrishnan,BVA Interior and Spatial Design,2,gopikka712@gmail.com,Student
2024UG05032,Ruchitha G ,BVA Interior and Spatial Design,2,ruchitharuchitha215@gmail.com,Student
2023UG05041,ALAN RAJ P V,BVA Animation and Game Art,3,alanraj1411@gmail.com,Student
2023UG05049,ANANDHA BHAGYA A P,BVA Animation and Game Art,3,anandhabhagyapa@gmail.com,Student
2023UG05021,ARAVINDH,BVA Animation and Game Art,3,aravindhsri321598@gmail.com,Student
2023UG05032,BALASUBRAMANI.J,BVA Animation and Game Art,3,balasubramani.j001@gmail.com,Student
2023UG05051,BELLAMKONDA VAMSI,BVA Animation and Game Art,3,Vamsinandhansaaho@gmail.com,Student
2023UG05034,BINS B I,BVA Animation and Game Art,3,binscincycincy@gmail.com,Student
2023UG05016,BOOPATHI A,BVA Animation and Game Art,3,boopathi11705@gmail.com,Student
2023UG05028,DHANRAJ K,BVA Animation and Game Art,3,dhanraj.k1024@gmail.com,Student
2023UG05059,DWARAKESH T S,BVA Animation and Game Art,3,dwarakeshx@gmail.com,Student
2023UG05057,FREDDY SAJAN,BVA Animation and Game Art,3,freddysajan2004@gmail.com,Student
2023UG05054,GANGISETTY DURGA SIVA KIRAN,BVA Animation and Game Art,3,kiransivadurga12@gmail.com,Student
2023UG05036,HAYAN HASHIF,BVA Animation and Game Art,3,Hayanhashif218@gmail.com ,Student
2023UG05042,K UMA SHANKAR,BVA Animation and Game Art,3,umas63730@gmail.com,Student
2023UG05053,KARTHIK N M,BVA Animation and Game Art,3,sumakarthik07@gmail.com,Student
2023UG05040,KARTHIK SATISH NAIR ,BVA Animation and Game Art,3,karthiknair0504@gmail.com,Student
2023UG05025,MADHAN A,BVA Animation and Game Art,3,mathanmathan9986@gmail.com,Student
2023UG05048,MD AKIV,BVA Animation and Game Art,3,mdnizamkhan78611@gmail.com,Student
2023UG05039,MD TOUFIQ SHAIKH,BVA Animation and Game Art,3,toufiqsk143668@gmail.com,Student
2023UG05013,MITHIRAN V,BVA Animation and Game Art,3,mithiranvaradarajan@gmail.com,Student
2023UG05022,MUGUNDHAN R,BVA Animation and Game Art,3,mugundhan863@gmail.com,Student
2023UG05047,NAMAN MAHINDRAKAR,BVA Animation and Game Art,3,namanmahindrakar@gmail.com,Student
2023UG05052,NAVANEETH S,BVA Animation and Game Art,3,navynavaneeth14@gmail.com ,Student
2023UG05026,PAVITHRA A,BVA Animation and Game Art,3,pavisbook@gmail.com,Student
2023UG05035,RAKSHIT SUKHPAL,BVA Animation and Game Art,3,rakshitsukhpal05@gmail.com,Student
2023UG05037,REENU HARIHARAN ,BVA Animation and Game Art,3,reenuhariharan@gmail.com,Student
2023UG05018,ROSHINI.R,BVA Animation and Game Art,3,roshroshini9986@gmail.com ,Student
2023UG05012,SHESHADRI,BVA Animation and Game Art,3,sheshadrideshpande2404@gmail.com,Student
2023UG05045,SHREYA G,BVA Animation and Game Art,3,gshreya2492004@gmail.com,Student
2023UG05020,SHREYA. VINOD,BVA Animation and Game Art,3,shreyavinod6@gmail.com,Student
2023UG05050,SHRIDEVI PUTTARAJ VASTRAD,BVA Animation and Game Art,3,Shriuvast4321@gmail.com,Student
2023UG05005,SOUMODIP BISWAS ,BVA Animation and Game Art,3,soumodipbiswas20@gmail.com,Student
2023UG05011,VISHNU VARDHAN.S,BVA Animation and Game Art,3,vishnuvardhan200604@gmail.com,Student
2023UG05055,VIVEK T K,BVA Animation and Game Art,3,krishnakumarkannan435@gmail.com,Student
2023UG05061,AKSHAT GUPTA,BVA Animation and Game Art,3,akshat.sos24@gmail.com,Student
2023UG05010,BHOOMIKA C R,BVA Graphics and Communication Design,3,bhoomikarameshc@gmail.com,Student
2023UG05015,GAURI JAYAKRISHNAN ,BVA Graphics and Communication Design,3,gaurijayakrishnan2020@gmail.com,Student
2023UG05002,GOPIKA K.G,BVA Graphics and Communication Design,3,kggopika98@gmail.com,Student
2023UG05043,JAGATHKISHORE G,BVA Graphics and Communication Design,3,jagath6422@gmail.com,Student
2023UG05017,LIKHITHA P ,BVA Graphics and Communication Design,3,adarkkid@gmail.com,Student
2023UG05019,SWARASHREE B R ,BVA Graphics and Communication Design,3,swarashreebr16@gmail.com,Student
2023UG,S PRAVEEN ,BVA Graphics and Communication Design,3,mspraveen8224@gmail.com,Student
2023UG05031,BHUMI,BVA Interior and Spatial Design,3,bhumidhawan78@gmail.com,Student
2023UG05058,M SANJANA ,BVA Interior and Spatial Design,3,sanjanax45@gmail.com,Student
2023UG05038,NOORAIN HAALA,BVA Interior and Spatial Design,3,Noorain.haala@gmail.com,Student
2023UG05029,VIJETHA SUNAYANA,BVA Interior and Spatial Design,3,kusumavijetha90@gmail.com,Student
2023UG06250,ADITHYAN PK,BSc UI/UX Design,3,adipkadithyan@gmail.com,Student
2023UG06224,ANUPRIYA N P ,BSc UI/UX Design,3,anupriyanp2005@gmail.com,Student
2023UG06015,ARSALAN ALI AHMED,BSc UI/UX Design,3,arsalanaliahmed17@gmail.com,Student
2023UG06236,ARUN P,BSc UI/UX Design,3,arunchandralayam100@gmail.com,Student
2023UG06204,SAMARTH JAIN,BSc UI/UX Design,3,samarthjain.3636@gmail.com ,Student
2023UG06263,SHIVANAND,BSc UI/UX Design,3,v6188812@gmail.com,Student
2023UG06258,SHUBHAM BHARDWAJ ,BSc UI/UX Design,3,s0505bhardwaj@gmail.com,Student
2023UG06237,THEJUS MATHEW,BSc UI/UX Design,3,thejas9645@gmail.com,Student
2023UG06233,VYSHAK. C,BSc UI/UX Design,3,vyshakraj44@gmail.com,Student
2023UG06144,BENIHIN G,BSc Photography,3,photographyben6@gmail.com,Student
2023UG06254,BISWAJIT SEN,BSc Photography,3,biswajitsen6860@gmail.com,Student
2023UG06128,HARISANKAR J,BSc Photography,3,Harisankar51983@gmail.com,Student
2023UG06256,JAMI ASHOK BABU,BSc Photography,3,ashokarjun7416@gmail.com,Student
2023UG06216,JOSHUA JOHNSON,BSc Photography,3,jj1964135@gmail.com,Student
2023UG06114,MOHAMMED MUIZZ KHALANDAR ,BSc Photography,3,Muizz.k101@gmail.com,Student
2023UG06206,MONISHWARAN K ,BSc Photography,3,monishwaran77@gmail.com,Student
2023UG06197,MUSHTAQ M,BSc Photography,3,shakeelmushtaq003@gmail.com,Student
2023UG06255,PRADEEP KUMAR D,BSc Photography,3,Pradeepfox44@gmail.com,Student
2023UG06209,PRAJWAL K R,BSc Photography,3,rajanikanthkkr@gmail.com,Student
2023UG06225,TULASI ABHIRAM,BSc Photography,3,tulasiabhiram303@gmail.com,Student
2023UG06263,VIBUSHA,BSc Photography,3,vibushar011@gmail.com,Student
2023UG06211,VISMAYA I L,BSc Photography,3,vismayaiskakiri@gmail.com,Student
2023UG06222,VUNTLA NITHISHKUMAR REDDY,BSc Photography,3,luckynithish1432@gmail.com,Student
2023UG06210,PATIL SHARDUL NITIN,BSc Media Technology,3,Shardul.patil271@gmail.com,Student
2023UG06215,ABHIRAMY C S,BSc Media Technology,3,abhiramy2005@gmail.com,Student
2023UG06031,MOHAMMED MUKTHAR,BSc Media Technology,3,Muktharmkr123@gmail.com,Student
2023UG06030,KUMAR MIRNAL,BSc Media Technology,3,mrinal8877@gmail.com,Student
2023UG06055,NISHANTH S RAMESH,BSc Media Technology,3,nishanthsramesh6@gmail.com,Student
2023UG06198,ARJUN S,BSc Media Technology,3,achu03kichu@gmail.com,Student
2023UG06235,ANANTHAKRISHNAN B,BSc Media Technology,3,ananthakrishnan8664@gmail.com,Student
2023UG06228,ASWIN KS,BSc Media Technology,3,aswinks111204@gmail.com ,Student
2023UG06246,MONISH S,BSc Media Technology,3,smonish678@gmail.com,Student
2023UG06183,BHUMIREDDY GOKUL NANDAN REDDY,BSc Media Technology,3,gokulnandanreddy@gmail.com,Student
2023UG06079,AJIN SANKAR,BSc Media Technology,3,ajinsankar49@gmail.com,Student
2023UG06207,CHARAN GOUTHAM SINGH,BSc Media Technology,3,singhgoutham8@gmail.com,Student
2023UG06141,AAKASH R S,BSc Media Technology,3,aakashrs5570@gmail.com,Student
2023UG06059,THOTA NIKHIL,BSc Media Technology,3,thotanikhil258@gmail.com,Student
2023UG06135,SIFARATH ROSHAN C S ,BSc Media Technology,3,sifarathroshan4@gmail.com,Student
2023UG06098,ARFA,BSc Game Art & Design,3,Arfa.13iqbal@gmail.com,Student
2023UG06117,HRISHIKESH LOKUR,BSc Game Art & Design,3,lokurhrishikesh@gmail.com,Student
2023UG06189,LAD ATHARVA SANTOSH ,BSc Game Art & Design,3,atharvalad05@gmail.com,Student
2023UG06080,NAYAN BANDU TUPE,BSc Game Art & Design,3,nayantupe89@gmail.com,Student
2023UG06251,PRITHWIRAJ NATH,BSc Game Art & Design,3,prithwirajnath4769@gmail.com,Student
2023UG06097,RAUNAK SINHA,BSc Game Art & Design,3,sinharaunak255@gmail.com,Student
2023UG06143,SIRINGI NIKHIL,BSc Game Art & Design,3,nikhilsiringi99@gmail.com,Student
2023UG06017,VIDIT MODI,BSc Game Art & Design,3,viditmodi05@gmail.com,Student
2023UG06252,WAHED SUHAEL UKAYE,BSc Game Art & Design,3,wahed1905@gmail.com ,Student
2023UG06174,BARATH M,BSc Game Art & Design,3,barathmohan2005k@gmail.com,Student
2023UG06105,MANU ADHIKARI ,BSc Game Art & Design,3,manuadhi94@gmail.com,Student
2023UG06019,ADITHYAN V S,BSc Game Design & Development,3,adiardram@gmail.com,Student
2023UG06260,ARJUN.M.B,BSc Game Design & Development,3,Arjunmab7@gmail.com,Student
2023UG06078,Hanuansh Arya Shrivastava ,BSc Game Design & Development,3,hanuansh0@gmail.com,Student
2023UG06127,JASHWANTH G S,BSc Game Design & Development,3,jeshuy0808@gmail.com ,Student
2023UG06226,JASHWANTH SR,BSc Game Design & Development,3,jashu.777.sr@gmail.com,Student
2023UG06042,KIRAN RAJENDRAKUMAR,BSc Game Design & Development,3,kiranrajendrakumar2811@gmail.com,Student
2023UG06056,KOTA PRAMOD SAINADH,BSc Game Design & Development,3,pramodsainadh123@gmail.com,Student
2023UG06231,MELVIN MATHEW ,BSc Game Design & Development,3,mathewmelvin029@gmail.com,Student
2023UG06113,N SAI THARUN JANARDHAN,BSc Game Design & Development,3,synchronousgamingyt@gmail.com,Student
2023UG06021,Naman Chopra,BSc Game Design & Development,3,namanchopra339@gmail.com,Student
2023UG06130,NIKHIL K A,BSc Game Design & Development,3,kaippilly.nikhil@gmail.com,Student
2023UG06253,NILAY PANDEY ,BSc Game Design & Development,3,nilayp2005@gmail.com,Student
2023UG06136,NIRANJAN JAYAN,BSc Game Design & Development,3,niranjan.jayan111@gmail.com,Student
2023UG06112,PERUMAL POTHAN NAGESH,BSc Game Design & Development,3,Pepoperumal262@gmail.com,Student
2023UG06054,ROSHAN H ,BSc Game Design & Development,3,tigerboss46888@gmail.com,Student
2023UG06044,VIGNESH CHARAN S ,BSc Game Design & Development,3,vikkydancer007@gmail.com,Student
2023UG06102,SAHIL MAHAWAR,BSc Game Design & Development,3,sahilmahawar0605@gmail.com,Student
2023UG06248,SIFIN JIJO,BSc Game Design & Development,3,sifinjijo007@gmail.com,Student
2023UG06013,Sravan Sushil,BSc Game Design & Development,3,srysrvn@gmail.com,Student
2023UG06018,VAIBHAV BISHT,BSc Game Design & Development,3,vaibhavbisht52@gmail.com,Student
2023UG06020,DHANUSH ADHITHYAN J D,BSc Game Design & Development,3,adhithyandhanush8@gmail.com,Student
2023UG06129,ABHIJITH T K,BSc Visual Effects,3,abhijithtk651@gmail.com,Student
2023UG06186,AKAASH P R,BSc Visual Effects,3,akaashak09@gmail.com,Student
2023UG06262,ALAN THEJAS,BSc Visual Effects,3,alanthejas3124@gmail.com,Student
2023UG06104,Aman Jain,BSc Visual Effects,3,jaina3039@gmail.com,Student
2023UG06218,DHARUN KUMAR J,BSc Visual Effects,3,tharunkumar3010@gmail.com,Student
2023UG06229,DUDHATRA VAIBHAV ,BSc Visual Effects,3,vaibhavdidhatra678@gmail.com,Student
2023UG06230,HASIN HOSSAIN ,BSc Visual Effects,3,gamingawesome157@gmail.com,Student
2023UG06028,KOTAPROLU SAI CHARAN,BSc Visual Effects,3,charan.mail2006@gmail.com,Student
2023UG06070,MD ABDULLAH NASIR ,BSc Visual Effects,3,abdullahkhan53412@gmail.com,Student
2023UG06014,SREERAM VINOD K,BSc Visual Effects,3,Sreeramvinod916@gmail.com,Student
2023UG06188,V GOURI CHARAN,BSc Visual Effects,3,charanicat722@gmail.com,Student
2023UG06261,VINAYAKAN P.A,BSc Visual Effects,3,Vinayakanvinu44@gmail.com,Student
2022UG05003,SAKSHI DESAI,BVA Animation and Game Art,4,desai.sakshi05@gmail.com,Student
2022UG05019,D SIMI SINDHU,BVA Animation and Game Art,4,dharmendrannaidu1976@gmail.com,Student
2022UG05010,DHANALAKSHMI N,BVA Animation and Game Art,4,dhanalakshmi042005@gmail.com,Student
2022UG05028,SHIRSO CHATTERJEE,BVA Animation and Game Art,4,chatterjeeshirso@gmail.com,Student
2022UG05038,KURUBA PUJARI RAVI TEJA,BVA Animation and Game Art,4,kpraviteja444@gmail.com,Student
2022UG05047,SHUBHAM GURUNG,BVA Animation and Game Art,4,SHUBUTAMU@GMAIL.COM,Student
2022UG05051,SHIVA SAI H R,BVA Animation and Game Art,4,shivasaihr16@gmail.com,Student
2022UG05005,SARATH RAJU,BVA Animation and Game Art,4,Sharathr2002@gmail.com,Student
2022UG05017,RAHUL KRISHNA.R,BVA Animation and Game Art,4,luharluhar0987@gmail.com,Student
2022UG05002,BARATH KRISHNA P J,BVA Animation and Game Art,4,kichuttan078@gmail.com,Student
2022UG05027,GOWTHAM M,BVA Animation and Game Art,4,GOWTHAM172641@GMAIL.COM,Student
2022UG05016,CHRIS VIVIN FRANCIS,BVA Animation and Game Art,4,chrisvivin77@gmail.com,Student
2022UG05033,SABARISH S S,BVA Animation and Game Art,4,sabarishca2004@gmail.com,Student
2022UG05030,SARVESHWARAN J P,BVA Animation and Game Art,4,basearts232004@gmail.com,Student
2022UG05034,SANJAY S,BVA Animation and Game Art,4,sujasanthosh947@gmail.com,Student
2022UG05045,TOM JOSEPH M,BVA Animation and Game Art,4,tomjoseph9876@gmail.com,Student
2022UG05041,NIKILAN M,BVA Animation and Game Art,4,nikilkalpana@gmail.com,Student
2022UG05053,SUJAN N,BVA Animation and Game Art,4,sujantellis77@gmail.com,Student
2022UG05054,ADARSH SHANKARAPPA NAREGAL,BVA Animation and Game Art,4,adarshnaregal@gmail.com,Student
2022UG05035,MINAL PARIHAR,BVA Graphics and Communication Design,4,minalparihar1@gmail.com,Student
2022UG05011,SIDRA SIDDIQUI,BVA Graphics and Communication Design,4,sidrasiddiqui2513@gmail.com,Student
2022UG05009,ALEN K AJI,BVA Graphics and Communication Design,4,alenaji6102004@gmail.com,Student
2022UG05025,ARCHITH F BARNS,BVA Graphics and Communication Design,4,afbarns@gmail.com,Student
2022UG05036,ARZ AHMED,BVA Graphics and Communication Design,4,arzvp04@gmail.com,Student
2022UG05004,RAASHI SWAMI,BVA Graphics and Communication Design,4,raashiswami22@gmail.com,Student
2022UG05031,SREE KANTH M P,BVA Graphics and Communication Design,4,sreekanthmp312@gmail.com,Student
2022UG05049,DHEERAJ GOPI,BVA Graphics and Communication Design,4,dheerajgopi007@gmail.com,Student
2022UG05014,AGNEY G S,BVA Graphics and Communication Design,4,agneypba@gmail.om,Student
2022UG05008,SACHIT BHARDWAJ,BVA Graphics and Communication Design,4,sachitbhardwaj0@gmail.com,Student
2022UG05015,ADVENTINA A M,BVA Graphics and Communication Design,4,adventina2004@gmail.com,Student
2022UG05029,SHREYA HEGDE,BVA Graphics and Communication Design,4,SHREYAHEGDE087@GMAIL.COM,Student
2022UG05044,PALLAVI KUMARI PRASAD,BVA Graphics and Communication Design,4,prasadpallavi893@gmail.com,Student
2022UG05024,ARUN KUMAR K J,BVA Graphics and Communication Design,4,jagadeesanmani15@gmail.com,Student
2022UG05018,SUHAS R,BVA Interior and Spatial Design,4,SUHAS9611322953@GMAIL.COM,Student
2022UG05037,RAJUWAN CHOUDHARY,BVA Interior and Spatial Design,4,rajuwanchoudhary@gmail.com,Student
2022UG05023,JUVERIA KHATOON,BVA Interior and Spatial Design,4,juveriakhan313@gmail.com,Student
2022UG05020,KOPPARAPU VANDITH KRISHNA,BVA Interior and Spatial Design,4,vandithkrishna6@gmail.com,Student
2022UG05040,POOJA JAYAPRAKASH,BVA Interior and Spatial Design,4,poojajayaprakash924@gmail.com,Student
2022UG05052,NITHIN K S,BVA Interior and Spatial Design,4,nithinniths14@gmail.com,Student
2025PG03003,Alver Agnelo Furtado,PGPP Game Design,1,alverfurtado@gmail.com,Student
2025PG03012,Gowtham G Rao,PGPP Game Design,1,gowthamgrao123@gmail.com,Student
2025PG03005,Harish V,PGPP Game Design,1,harianitha1798@gmail.com,Student
2025PG03014,Jeevanth Krishna,PGPP Game Design,1,jeevanth221@gmail.com,Student
2025PG03007,SAMUEL M,PGPP Game Design,1,mathewsamuelj22@gmail.com,Student
2025PG03002,Sharon Harshini A,PGPP Game Design,1,harshinisharon13@gmail.com,Student
2025PG03015,Siddharth V K,PGPP Game Design,1,vksiddharth16@gmail.com,Student
2025PG03008,VISHAL V,PGPP Game Design,1,vishal54534@gmail.com,Student
2025PG03010,Abhinay. T. S,PGPP UI/UX,1,abhinayappu6@gmail.com,Student
2025PG03009,Charan Billava,PGPP UI/UX,1,charanpoojari266@gmail.com,Student
2025PG03013,JINU BENNY P A,PGPP UI/UX,1,jinubenny319@gmail.com,Student
2025PG03016,MALLIKARJUN HUNASIKATTI,PGPP UI/UX,1,abhimallikarjun123@gmail.com,Student
2025PG03001,Manish Kumar Sinha,PGPP UI/UX,1,manishsinha2612@gmail.com,Student
2025PG03017,P B Ranjith,PGPP UI/UX,1,ranjithbadkillaya004@gmail.com,Student
2025PG03004,Roshan B,PGPP UI/UX,1,roshanromu15@gmail.com,Student
2025PG03011,Shabil Muhammed M S,PGPP UI/UX,1,shabilmuhammed137@gmail.com,Student
2025PG03020,Snehashree S G,PGPP UI/UX,1,snehashreesg15@gmail.com,Student
2025PG03018,SREYA.K.N,PGPP UI/UX,1,knsreya@gmail.com,Student
2025PG03019,VRUNDHA R,PGPP UI/UX,1,vrundhar7@gmail.com,Student
2025PG03022,NEHAD T,PGPP UI/UX,1,nehadt838@gmail.com,Student
2024MSC06030,Adam Clyde Gonsalves ,MSc Game Technology,1,gonsalvesadam62@gmail.com,Student
2024MSC06050,Adithya Premjith ,MSc Game Technology,1,adithyapremjith2002@gmail.com,Student
2024MSC06042,Aniket Sudarshan Mate,MSc Game Technology,1,amate647@gmail.com,Student
2024MSC06047,Athul jo,MSc Game Technology,1,athuljobaji@gmail.com,Student
2024MSC06005,ATHUL K M,MSc Game Technology,1,athulashokan03@gmail.com,Student
2024MSC06004,AYAAN KHAN,MSc Game Technology,1,ayaankhan1363@gmail.com,Student
2024MSC06025,Jnana Prabhavana V R,MSc Game Technology,1,Jnanaprabhava10@gmail.com,Student
2024MSC06019,Maheesh Sadanandan ,MSc Game Technology,1,maheeshsadanandan13@gmail.com,Student
2024MSC06007,Naveen E,MSc Game Technology,1,Naveen.e4593@gmail.com,Student
2024MSC06027,Tharakeshwar Umanand,MSc Game Technology,1,u.tharakeshwar@gmail.com,Student
2024MSC06022,Yogeshwaran M,MSc Game Technology,1,Yogeshwaran6604@gmail.com,Student
2024MSC06024,Yuvraj M,MSc Game Technology,1,yuvrajgamedev@gmail.com,Student
2024MSC06035,ARUN KUMAR A ,MSc Multimedia,1,arunkumara20uel1004@gmail.com,Student
2024MSC06021,Blessy N ,MSc Multimedia,1,nblessy4@gmail.com,Student
2024MSC06006,FELIX XAVIER A,MSc Multimedia,1,felixxavier1821@gmail.com,Student
2024MSC06040,KOWSHIK S,MSc Multimedia,1,dkskowshik@gmail.com,Student
2024MSC06008,Nehal Mehta,MSc Multimedia,1,nehalmehtaaa@gmail.com,Student
2024MSC06003,SAAM ROSHAN A,MSc Multimedia,1,samroshan724@gmail.com,Student
2024MSC06034,THAMBALLAPLLE VENKATESH,MSc Multimedia,1,venkyvenkatesh8945@gmail.com,Student
2025MSC06008,AJAY S BABU,MSc Game Technology,2,ajbabu071@gmail.com,Student
2025MSC06023,Ganti Surya Teja,MSc Game Technology,2,ganti.teja007@gmail.com,Student
2025MSC06004,Giridharan K,MSc Game Technology,2,kasigiridhar888@gmail.com,Student
2025MSC06046,Gopika krishnan,MSc Game Technology,2,gopikakgokulam@gmail.com,Student
2025MSC06003,Guvalla Chakradhar,MSc Game Technology,2,chakradharguvalla11@gmail.com,Student
2025MSC06013,Krish barfa,MSc Game Technology,2,Krishbarfa7470@gmail.com,Student
2025MSC06007,Mayank Choudhary,MSc Game Technology,2,mayankchoudhary026@gmail.com,Student
2025MSC06037,MEGHANA T G,MSc Game Technology,2,meghanaganesh98@gmail.com,Student
2025MSC06048,Rabimon M,MSc Game Technology,2,rabimon45@gmail.com,Student
2025MSC06002,RONIT PRAKASH,MSc Game Technology,2,ronitprakash694@gmail.com,Student
2025MSC06047,Vinay Sankar V,MSc Game Technology,2,sankarvinay70@gmail.com,Student
2025MSC06032,Akash G S,MSc Multimedia,2,akashshashi0307@gmail.com,Student
2025MSC06028,Ankita Das,MSc Multimedia,2,byankieee@gmail.com,Student
2025MSC06019,Dipti Lilesh Patle,MSc Multimedia,2,diptipatle30@gmail.com,Student
2025MSC06045,Ishan Patowary,MSc Multimedia,2,ishaanpatowary9@gmail.com,Student
2025MSC06009,Nelson Jefrin Xavier C,MSc Multimedia,2,charlesjefrin19njx@gmail.com,Student
2025MSC06027,Sayantan Sanyal,MSc Multimedia,2,sayantansanyalicat@gmail.com,Student
2025MSC06034,Susmitha,MSc Multimedia,2,velayuthamsusmitha@gmail.com,Student`;

const CURRICULUM_CSV = `S No,Program Title,Year,Sem,Type,ModuleTitle,Sub/ Specialization Module,Full Module Title,Module Code
1,BVA Visual Arts  (Foundation),1,1,Core,Design Fundamentals- I (Practical),,Design Fundamentals- I (Practical),BF11
2,BVA Visual Arts  (Foundation),1,1,Core,Drawing Fundamentals I -(Practical),,Drawing Fundamentals I -(Practical),BF12
3,BVA Visual Arts  (Foundation),1,1,Core,Design LanguageI (Theory ),,Design LanguageI (Theory ),BF13
4,BVA Visual Arts  (Foundation),1,1,Core,Inter Design Studies- 1,,Inter Design Studies- 1,BF14
5,BVA Visual Arts  (Foundation),1,1,Non Core,Language I,,Language I,BF15
6,BVA Visual Arts  (Foundation),1,1,Non Core,Language II,,Language II,BF16
7,BVA Visual Arts  (Foundation),1,1,Non Core,Computer Applications,,Computer Applications,BF17
8,BVA Visual Arts  (Foundation),1,1,Non Core,Health & Wellness And,,Health & Wellness And,BF18
9,BVA Visual Arts  (Foundation),1,1,Non Core,Yoga,,Yoga,BF19
10,BVA Visual Arts  (Foundation),1,2,Core,Design Fundamentals- II (Practical),,Design Fundamentals- II (Practical),BF21
11,BVA Visual Arts  (Foundation),1,2,Core,Drawing Fundamentals II -(Practical),,Drawing Fundamentals II -(Practical),BF22
12,BVA Visual Arts  (Foundation),1,2,Core,Design Language II (Theory ),,Design Language II (Theory ),BF23
13,BVA Visual Arts  (Foundation),1,2,Core,Inter Design Studies- II,,Inter Design Studies- II,BF24
14,BVA Visual Arts  (Foundation),1,2,Non Core,Language I,,Language I,BF25
15,BVA Visual Arts  (Foundation),1,2,Non Core,Language II,,Language II,BF26
16,BVA Visual Arts  (Foundation),1,2,Non Core,Env. Studies(2),,Env. Studies(2),BF27
17,BVA Visual Arts  (Foundation),1,2,Non Core,Sports,,Sports,BF28
18,BVA Visual Arts  (Foundation),1,2,Non Core,Ncc/Nss/R&R(S &G) / Cultural,,Ncc/Nss/R&R(S &G) / Cultural,BF29
19,BVA Animation and Game Art,2,1,Core,Animation Foundation (Practical),,Animation Foundation (Practical),BA31
20,BVA Animation and Game Art,2,1,Core,Art for Animation-I-(Practical),,Art for Animation-I-(Practical),BA32
21,BVA Animation and Game Art,2,1,Core,Computer Graphics Fundamentals  (Practical),,Computer Graphics Fundamentals  (Practical),BA33
22,BVA Animation and Game Art,2,1,Core,Story concepts-Visualization  (Theory ),,Story concepts-Visualization  (Theory ),BA34
23,BVA Animation and Game Art,2,1,Non Core,Language I,,Language I,BA35
24,BVA Animation and Game Art,2,1,Non Core,Language II,,Language II,BA36
25,BVA Animation and Game Art,2,1,Non Core,Indian Constitution,,Indian Constitution,BA37
26,BVA Animation and Game Art,2,1,Non Core,Sports/NCC/NSS/R&R(S&G),,Sports/NCC/NSS/R&R(S&G),BA38
27,BVA Animation and Game Art,2,1,Non Core,Skills,,Skills,BA39
28,BVA Animation and Game Art,2,2,Core,3D CGI Foundation  (Practical),,3D CGI Foundation  (Practical),BA41
29,BVA Animation and Game Art,2,2,Core,2D-3D Digital Animation -(Practical),,2D-3D Digital Animation -(Practical),BA42
30,BVA Animation and Game Art,2,2,Core,Art for Animation – II (Practical),,Art for Animation – II (Practical),BA43
31,BVA Animation and Game Art,2,2,Core,Camera & film editing (Theory ),,Camera & film editing (Theory ),BA44
32,BVA Animation and Game Art,2,2,Non Core,Language I,,Language I,BA45
33,BVA Animation and Game Art,2,2,Non Core,Language II,,Language II,BA46
34,BVA Animation and Game Art,2,2,Non Core,Job Skills,,Job Skills,BA47
35,BVA Animation and Game Art,2,2,Non Core,Sports/NCC/NSS/R&R(S&G),,Sports/NCC/NSS/R&R(S&G),BA48
36,BVA Animation and Game Art,2,2,Non Core,Skills,,Skills,BA49
37,BVA Animation and Game Art,3,1,Core,Preproduction; Script to Animatic (Practical),,Preproduction; Script to Animatic (Practical),BA51
38,BVA Animation and Game Art,3,1,Core,Character Animation (Practical),,Character Animation (Practical),BA52
39,BVA Animation and Game Art,3,1,Core,BG Design and Development (Practical),,BG Design and Development (Practical),BA53
40,BVA Animation and Game Art,3,1,Core,History of Animation (Theory),,History of Animation (Theory),BA54
41,BVA Animation and Game Art,3,1,Non Core,VA E1: Photography (Practical),,VA E1: Photography (Practical),BA55
42,BVA Animation and Game Art,3,1,Non Core,VA E2: Camera and Film editing (Practical),,VA E2: Camera and Film editing (Practical),BA56
43,BVA Animation and Game Art,3,1,Non Core,VA E3: Revitalization of arts & crafts (Practical),,VA E3: Revitalization of arts & crafts (Practical),BA57
44,BVA Animation and Game Art,3,1,Non Core,Vocational Course 1: Visual Merchandising,,Vocational Course 1: Visual Merchandising,BA58
45,BVA Animation and Game Art,3,1,Non Core,Job Skills,,Job Skills,BA59
46,BVA Animation and Game Art,3,2,Core,Postproduction (Practical),,Postproduction (Practical),BA61
47,BVA Animation and Game Art,3,2,Core,Character Design and Development (Practical),,Character Design and Development (Practical),BA62
48,BVA Animation and Game Art,3,2,Core,Game Art (Practical),,Game Art (Practical),BA63
49,BVA Animation and Game Art,3,2,Core,Acting For Animation (Theory),,Acting For Animation (Theory),BA64
50,BVA Animation and Game Art,3,2,Non Core,VA E1. Motion Graphics,,VA E1. Motion Graphics,BA65
51,BVA Animation and Game Art,3,2,Non Core,VA E2. Digital Illustration Technique,,VA E2. Digital Illustration Technique,BA66
52,BVA Animation and Game Art,3,2,Non Core,VA E3. Game Design,,VA E3. Game Design,BA67
53,BVA Animation and Game Art,3,2,Non Core,Vocational 2: Retail Design,,Vocational 2: Retail Design,BA68
54,BVA Animation and Game Art,3,2,Core,Internship (2),,Internship (2),BA69
55,BVA Animation and Game Art,4,1,Core,Graduation Project–Part I,,Graduation Project–Part I,BA71
56,BVA Animation and Game Art,4,1,Core,Major Specialization:,2D - 3D Animation,Major Specialization:2D - 3D Animation,BA721
57,BVA Animation and Game Art,4,1,Core,Major Specialization:,3D CGI for Animation Film,Major Specialization:3D CGI for Animation Film,BA722
58,BVA Animation and Game Art,4,1,Core,Major Specialization:,3D CGI for Game Art,Major Specialization:3D CGI for Game Art,BA723
59,BVA Animation and Game Art,4,1,Core,Major Specialization:,Visual Effects & Compositing,Major Specialization:Visual Effects & Compositing,BA724
60,BVA Animation and Game Art,4,1,Core,Major Specialization:,Pre-Production,Major Specialization:Pre-Production,BA725
61,BVA Animation and Game Art,4,1,Core,Design Thesis,,Design Thesis,BA73
62,BVA Animation and Game Art,4,1,Core,Portfolio Development,,Portfolio Development,BA74
63,BVA Animation and Game Art,4,1,Core,Discipline Specific Elective:,Interaction Design,Discipline Specific Elective:Interaction Design,BA751
64,BVA Animation and Game Art,4,1,Core,Discipline Specific Elective:,Web-Design  (HTML&CSS)Lab,Discipline Specific Elective:Web-Design  (HTML&CSS)Lab,BA752
65,BVA Animation and Game Art,4,1,Core,Discipline Specific Elective:,Film Appreciation,Discipline Specific Elective:Film Appreciation,BA753
66,BVA Animation and Game Art,4,2,Core,Graduation Project–Part II,,Graduation Project–Part II,BA81
67,BVA Animation and Game Art,4,2,Core,Internship,,Internship,BA82
68,BVA Graphics and Communication,2,1,Core,Graphic Design and Communication I (Practical),,Graphic Design and Communication I (Practical),BG31
69,BVA Graphics and Communication,2,1,Core,Basic Typography -(Practical),,Basic Typography -(Practical),BG32
70,BVA Graphics and Communication,2,1,Core,Digital Media-I (Practical),,Digital Media-I (Practical),BG33
71,BVA Graphics and Communication,2,1,Core,"Theory of Graphic Design I 
  (Theory )",,"Theory of Graphic Design I 
  (Theory )",BG34
72,BVA Graphics and Communication,2,1,Non-Core,Language-I,,Language-I,BG35
73,BVA Graphics and Communication,2,1,Non-Core,Language-II,,Language-II,BG36
74,BVA Graphics and Communication,2,1,Non-Core,Indian Constitution,,Indian Constitution,BG37
75,BVA Graphics and Communication,2,1,Non-Core,Sports/NCC/NSS/R&R(S&G),,Sports/NCC/NSS/R&R(S&G),BG38
76,BVA Graphics and Communication,2,1,Non-Core,Skills,,Skills,BG39
77,BVA Graphics and Communication,2,2,Core,Graphic Design and Communication II (Practical),,Graphic Design and Communication II (Practical),BG41
78,BVA Graphics and Communication,2,2,Core,"Advance Typography  
   -(Practical)",,"Advance Typography  
   -(Practical)",BG42
79,BVA Graphics and Communication,2,2,Core,Digital Media-II (Practical),,Digital Media-II (Practical),BG43
80,BVA Graphics and Communication,2,2,Core,Theory of  Graphic Design II (Theory ),,Theory of  Graphic Design II (Theory ),BG44
81,BVA Graphics and Communication,2,2,Non- Core,Language I,,Language I,BG45
82,BVA Graphics and Communication,2,2,Non- Core,Language II,,Language II,BG46
83,BVA Graphics and Communication,2,2,Non- Core,Job Skills,,Job Skills,BG47
84,BVA Graphics and Communication,2,2,Non- Core,Sports/NCC/NSS/R&R(S&G),,Sports/NCC/NSS/R&R(S&G),BG48
85,BVA Graphics and Communication,2,2,Non- Core,Skills,,Skills,BG49
86,BVA Graphics and Communication,3,1,Core,Graphic Design for Print & Web Media (Practical),,Graphic Design for Print & Web Media (Practical),BG51
87,BVA Graphics and Communication,3,1,Core,Graphic Design for gaming (Practical),,Graphic Design for gaming (Practical),BG52
88,BVA Graphics and Communication,3,1,Core,Information Design (Practical),,Information Design (Practical),BG53
89,BVA Graphics and Communication,3,1,Core,Theory of Advertising Design (Theory),,Theory of Advertising Design (Theory),BG54
90,BVA Graphics and Communication,3,1,Non- Core,Design Specific Elective,Photography ,Design Specific ElectivePhotography ,BG551
91,BVA Graphics and Communication,3,1,Non- Core,Design Specific Elective,Camera and Film editing ,Design Specific ElectiveCamera and Film editing ,BG552
92,BVA Graphics and Communication,3,1,Non- Core,Design Specific Elective,Revitalization of Arts & Crafts,Design Specific ElectiveRevitalization of Arts & Crafts,BG553
93,BVA Graphics and Communication,3,1,Non- Core,Vocational Course: Visual Merchandising,,Vocational Course: Visual Merchandising,BG56
94,BVA Graphics and Communication,3,1,Non- Core,Job Skills,,Job Skills,BG57
95,BVA Graphics and Communication,3,2,Core,Advertising Design & Media (Practical),,Advertising Design & Media (Practical),BG61
96,BVA Graphics and Communication,3,2,Core,Packaging Design and Printing Technology (Practical),,Packaging Design and Printing Technology (Practical),BG62
97,BVA Graphics and Communication,3,2,Core,Introduction to UI/UX Design (Practical),,Introduction to UI/UX Design (Practical),BG63
98,BVA Graphics and Communication,3,2,Core,Theory Visual communication & Media (Theory),,Theory Visual communication & Media (Theory),BG64
99,BVA Graphics and Communication,3,2,Non- Core,Value Added Elective,Motion Graphics ,Value Added ElectiveMotion Graphics ,BG651
100,BVA Graphics and Communication,3,2,Non- Core,Value Added Elective,Digital Illustration Technique,Value Added ElectiveDigital Illustration Technique,BG652
101,BVA Graphics and Communication,3,2,Non- Core,Value Added Elective,Game Design,Value Added ElectiveGame Design,BG653
102,BVA Graphics and Communication,3,2,Non- Core,Vocational Course: Retail Design,,Vocational Course: Retail Design,BG66
103,BVA Graphics and Communication,3,2,Core,Internship (2),,Internship (2),BG67
104,BVA Graphics and Communication,4,1,Core,Graduation Project – Part I,,Graduation Project – Part I,BG71
105,BVA Graphics and Communication,4,1,Core,Introductionto User Interface Design. (Practical),,Introductionto User Interface Design. (Practical),BG72
106,BVA Graphics and Communication,4,1,Core,Design Thesis,,Design Thesis,BG73
107,BVA Graphics and Communication,4,1,Core,Portfolio Development,,Portfolio Development,BG74
108,BVA Graphics and Communication,4,1,Non- Core,Discipline Specific Elective:,Interaction Design,Discipline Specific Elective:Interaction Design,BG75
109,BVA Graphics and Communication,4,1,Non- Core,Discipline Specific Elective:,UI&UX,Discipline Specific Elective:UI&UX,BG76
110,BVA Graphics and Communication,4,1,Non- Core,Discipline Specific Elective:,FilmAppreciation,Discipline Specific Elective:FilmAppreciation,BG77
111,BVA Graphics and Communication,4,2,Core,Graduation Project–Part II,,Graduation Project–Part II,BG81
112,BVA Graphics and Communication,4,2,Core,Internship,,Internship,BG82
113,BVA Interior and Spatial Design,2,1,Core,Form & Space - Furniture Design (Practical),,Form & Space - Furniture Design (Practical),BI31
114,BVA Interior and Spatial Design,2,1,Core,Interior Design Materials and Applications I-(Practical),,Interior Design Materials and Applications I-(Practical),BI32
115,BVA Interior and Spatial Design,2,1,Core,Technical Drawing (Practical),,Technical Drawing (Practical),BI33
116,BVA Interior and Spatial Design,2,1,Core,Design Thinking (Theory ),,Design Thinking (Theory ),BI34
117,BVA Interior and Spatial Design,2,1,Non- Core,Language I,,Language I,BI35
118,BVA Interior and Spatial Design,2,1,Non- Core,Language II,,Language II,BI36
119,BVA Interior and Spatial Design,2,1,Non- Core,Indian Constitution,,Indian Constitution,BI37
120,BVA Interior and Spatial Design,2,1,Non- Core,Sports/NCC/NSS/R&R(S&G),,Sports/NCC/NSS/R&R(S&G),BI38
121,BVA Interior and Spatial Design,2,1,Non- Core,Skills,,Skills,BI39
122,BVA Interior and Spatial Design,2,2,Core,Design Studio: Space & Planning  (Practical),,Design Studio: Space & Planning  (Practical),BI41
123,BVA Interior and Spatial Design,2,2,Core,Interior Design Materials and Applications II -(Practical),,Interior Design Materials and Applications II -(Practical),BI42
124,BVA Interior and Spatial Design,2,2,Core,Architectural Elements and Services  (Practical),,Architectural Elements and Services  (Practical),BI43
125,BVA Interior and Spatial Design,2,2,Core,History of Design (Interior Design ) (Theory ),,History of Design (Interior Design ) (Theory ),BI44
126,BVA Interior and Spatial Design,2,2,Non- Core,Language I,,Language I,BI45
127,BVA Interior and Spatial Design,2,2,Non- Core,Language II,,Language II,BI46
128,BVA Interior and Spatial Design,2,2,Non- Core,Job Skills,,Job Skills,BI47
129,BVA Interior and Spatial Design,2,2,Non- Core,Sports/NCC/NSS/R&R(S&G),,Sports/NCC/NSS/R&R(S&G),BI48
130,BVA Interior and Spatial Design,2,2,Non- Core,Skills,,Skills,BI49
131,BVA Interior and Spatial Design,3,1,Core,"Interior Design Studio II –
 Inhabitations (Practical)",,"Interior Design Studio II –
 Inhabitations (Practical)",BI51
132,BVA Interior and Spatial Design,3,1,Core,User Element Design (Practical),,User Element Design (Practical),BI52
133,BVA Interior and Spatial Design,3,1,Core,Advance Visualization Methods (Practical),,Advance Visualization Methods (Practical),BI53
134,BVA Interior and Spatial Design,3,1,Core,"Environmental control
  (Theory)",,"Environmental control
  (Theory)",BI54
135,BVA Interior and Spatial Design,3,1,Non Core,Value Added Elective I,Photography,Value Added Elective IPhotography,BI551
136,BVA Interior and Spatial Design,3,1,Non Core,Value Added Elective I,Camera and Film editing (Practical),Value Added Elective ICamera and Film editing (Practical),BI552
137,BVA Interior and Spatial Design,3,1,Non Core,Value Added Elective I,Revitalization of Arts & Crafts (Practical),Value Added Elective IRevitalization of Arts & Crafts (Practical),BI553
138,BVA Interior and Spatial Design,3,1,Non Core,Vocational Course 1: Visual Merchandising (Practical),,Vocational Course 1: Visual Merchandising (Practical),BI56
139,BVA Interior and Spatial Design,3,1,Non Core,Job Skills,,Job Skills,BI57
140,BVA Interior and Spatial Design,3,2,Core,Interior Design Studio: III (Practical),,Interior Design Studio: III (Practical),BI61
141,BVA Interior and Spatial Design,3,2,Core,Complex Furniture Systems(Practical),,Complex Furniture Systems(Practical),BI62
142,BVA Interior and Spatial Design,3,2,Core,Landscape Design(Practical),,Landscape Design(Practical),BI63
143,BVA Interior and Spatial Design,3,2,Core,"Estimation and Project
 Management (Theory)",,"Estimation and Project
 Management (Theory)",BI64
144,BVA Interior and Spatial Design,3,2,Non Core,Value Added Elective II,Motion Graphics(Practical),Value Added Elective IIMotion Graphics(Practical),BI651
145,BVA Interior and Spatial Design,3,2,Non Core,Value Added Elective II,Digital Illustration Technique(Practical),Value Added Elective IIDigital Illustration Technique(Practical),BI652
146,BVA Interior and Spatial Design,3,2,Non Core,Value Added Elective II,Game Design (Practical),Value Added Elective IIGame Design (Practical),BI653
147,BVA Interior and Spatial Design,3,2,Non Core,Vocational Course: Retail Design,,Vocational Course: Retail Design,BI66
148,BVA Interior and Spatial Design,3,2,Non Core,Internship,,Internship,BI67
149,BVA Interior and Spatial Design,4,1,Core,Graduation Project –Part I,,Graduation Project –Part I,BI71
150,BVA Interior and Spatial Design,4,1,Core,Sustainable Practicesin Design,,Sustainable Practicesin Design,BI72
151,BVA Interior and Spatial Design,4,1,Core,Design Thesis,,Design Thesis,BI73
152,BVA Interior and Spatial Design,4,1,Core,Portfolio Development,,Portfolio Development,BI74
153,BVA Interior and Spatial Design,4,1,Non Core,Discipline Specific Elective:,Interaction Design,Discipline Specific Elective:Interaction Design,BI751
154,BVA Interior and Spatial Design,4,1,Non Core,Discipline Specific Elective:,UI&UX ,Discipline Specific Elective:UI&UX ,BI752
155,BVA Interior and Spatial Design,4,1,Non Core,Discipline Specific Elective:,Film  Appreciation,Discipline Specific Elective:Film  Appreciation,BI753
156,BVA Interior and Spatial Design,4,1,Core,Graduation Project– Part II,,Graduation Project– Part II,BI81
157,BVA Interior and Spatial Design,4,1,Core,Internship,,Internship,BI82
158,B Sc UI Design,1,1,Non Core,Tamil/Other Languages-I,,Tamil/Other Languages-I,UI11
159,B Sc UI Design,1,1,Non Core,General English-I,,General English-I,UI12
160,B Sc UI Design,1,1,Core,Programming and scripting,,Programming and scripting,UI13
161,B Sc UI Design,1,1,Core,Programming and scripting- Practical,,Programming and scripting- Practical,UI14
162,B Sc UI Design,1,1,Core,Communication and Media Design ,,Communication and Media Design ,UI15
163,B Sc UI Design,1,1,Core,Visualization for Interactive Media- Practical,,Visualization for Interactive Media- Practical,UI16
164,B Sc UI Design,1,1,Non Core,Value Education,,Value Education,UI17
165,B Sc UI Design,1,1,Non Core,Library,,Library,UI18
166,B Sc UI Design,1,2,Non Core,Tamil/Other Languages,,Tamil/Other Languages,UI21
167,B Sc UI Design,1,2,Non Core,General English-II,,General English-II,UI22
168,B Sc UI Design,1,2,Core,UI Development I,,UI Development I,UI23
169,B Sc UI Design,1,2,Core,UI Development I - Practical,,UI Development I - Practical,UI24
170,B Sc UI Design,1,2,Core,UX Design-I,,UX Design-I,UI25
171,B Sc UI Design,1,2,Core,Design for Interactive media - Practical,,Design for Interactive media - Practical,UI26
172,B Sc UI Design,1,2,Non Core,Environmental Studies,,Environmental Studies,UI27
173,B Sc UI Design,1,2,Non Core,Library,,Library,UI28
174,B Sc UI Design,1,2,Core,Internship /Mini Project,,Internship /Mini Project,UI29
175,B Sc UI Design,2,1,Non Core,Tamil/Other Languages,,Tamil/Other Languages,UI31
176,B Sc UI Design,2,1,Non Core,General English-III,,General English-III,UI32
177,B Sc UI Design,2,1,Core,UI Visual Design,,UI Visual Design,UI33
178,B Sc UI Design,2,1,Core,UI Development II,,UI Development II,UI34
179,B Sc UI Design,2,1,Core,UI Development II- Practical,,UI Development II- Practical,UI35
180,B Sc UI Design,2,1,Core,UXDesign II,,UXDesign II,UI36
181,B Sc UI Design,2,1,Core,UI Visual Design - Practical,,UI Visual Design - Practical,UI37
182,B Sc UI Design,2,1,Non Core,Entrepreneurship,,Entrepreneurship,UI38
183,B Sc UI Design,2,1,Non Core,University Elective I:,Adipadai Tamil,University Elective I:Adipadai Tamil,UI391
184,B Sc UI Design,2,1,Non Core,University Elective I:,Advance Tamil,University Elective I:Advance Tamil,UI392
185,B Sc UI Design,2,1,Non Core,University Elective I:,IT Skills for Employment,University Elective I:IT Skills for Employment,UI393
186,B Sc UI Design,2,1,Non Core,University Elective I:,MOOC’S,University Elective I:MOOC’S,UI394
187,B Sc UI Design,2,2,Non Core,Tamil/Other Languages,,Tamil/Other Languages,UI41
188,B Sc UI Design,2,2,Non Core,General English-IV,,General English-IV,UI42
189,B Sc UI Design,2,2,Core,Web Application Development,,Web Application Development,UI43
190,B Sc UI Design,2,2,Core,Human Centered Design,,Human Centered Design,UI44
191,B Sc UI Design,2,2,Core,Web Application Development - Practical,,Web Application Development - Practical,UI45
192,B Sc UI Design,2,2,Core,Mobile Application Development,,Mobile Application Development,UI46
193,B Sc UI Design,2,2,Core,Mobile Application Development - Practical,,Mobile Application Development - Practical,UI47
194,B Sc UI Design,2,2,Non Core,University Elective II,Adipadai Tamil,University Elective IIAdipadai Tamil,UI481
195,B Sc UI Design,2,2,Non Core,University Elective II,Advance Tamil,University Elective IIAdvance Tamil,UI482
196,B Sc UI Design,2,2,Non Core,University Elective II,IT Skills for Employment,University Elective IIIT Skills for Employment,UI483
197,B Sc UI Design,2,2,Non Core,University Elective II,MOOC’S,University Elective IIMOOC’S,UI484
198,B Sc UI Design,2,2,Core,Internship,,Internship,UI49
199,B Sc UI Design,3,1,Core,Emerging Technologies,,Emerging Technologies,UI51
200,B Sc UI Design,3,1,Core,Software Quality Assurance,,Software Quality Assurance,UI52
201,B Sc UI Design,3,1,Core,Discipline Specific Elective I:,Human Computer Interaction,Discipline Specific Elective I:Human Computer Interaction,UI531
202,B Sc UI Design,3,1,Core,Discipline Specific Elective I:,AR and VR in UX Design,Discipline Specific Elective I:AR and VR in UX Design,UI532
203,B Sc UI Design,3,1,Core,Discipline Specific Elective I:,Brand Designing,Discipline Specific Elective I:Brand Designing,UI533
204,B Sc UI Design,3,1,Core,Discipline Specific Elective II:,Information Architecture,Discipline Specific Elective II:Information Architecture,UI541
205,B Sc UI Design,3,1,Core,Discipline Specific Elective II:,Digital Marketing,Discipline Specific Elective II:Digital Marketing,UI542
206,B Sc UI Design,3,1,Core,Discipline Specific Elective II:,Design Issues,Discipline Specific Elective II:Design Issues,UI543
207,B Sc UI Design,3,1,Core,Discipline Specific Elective III:,Prototyping - Practical,Discipline Specific Elective III:Prototyping - Practical,UI551
208,B Sc UI Design,3,1,Core,Discipline Specific Elective III:,Software Testing - Practical,Discipline Specific Elective III:Software Testing - Practical,UI552
209,B Sc UI Design,3,1,Core,Discipline Specific Elective III:,Usability Evaluation - Practical,Discipline Specific Elective III:Usability Evaluation - Practical,UI553
210,B Sc UI Design,3,1,Core,Portfolio & Presentation - Practical,,Portfolio & Presentation - Practical,UI56
211,B Sc UI Design,3,1,Non- Core,Career development / employability skills,,Career development / employability skills,UI57
212,B Sc UI Design,3,2,Core,Web Development Using React,,Web Development Using React,UI61
213,B Sc UI Design,3,2,Core,Advanced Framework - Tailwind,,Advanced Framework - Tailwind,UI62
214,B Sc UI Design,3,2,Core,Web Development Using React,,Web Development Using React,UI63
215,B Sc UI Design,3,2,Core,Discipline Specific Elective IV:,Wordpress - Practical,Discipline Specific Elective IV:Wordpress - Practical,UI641
216,B Sc UI Design,3,2,Core,Discipline Specific Elective IV:,SEO Strategy - Practical,Discipline Specific Elective IV:SEO Strategy - Practical,UI642
217,B Sc UI Design,3,2,Core,Discipline Specific Elective IV:,Motion Design and Animation - Practical,Discipline Specific Elective IV:Motion Design and Animation - Practical,UI643
218,B Sc UI Design,3,2,Core,Project/Dissertation,,Project/Dissertation,UI65
219,B Sc Multimedia Technologies,1,1,Non- Core,Tamil/Other Languages,,Tamil/Other Languages,MDT11
220,B Sc Multimedia Technologies,1,1,Non- Core,General English-I,,General English-I,MDT12
221,B Sc Multimedia Technologies,1,1,Core,Introduction to Visual Communication,,Introduction to Visual Communication,MDT13
222,B Sc Multimedia Technologies,1,1,Core,Graphic Design - Practical,,Graphic Design - Practical,MDT14
223,B Sc Multimedia Technologies,1,1,Core,Design Fundamentals,,Design Fundamentals,MDT15
224,B Sc Multimedia Technologies,1,1,Core,Image Editing Techniques - Practical,,Image Editing Techniques - Practical,MDT16
225,B Sc Multimedia Technologies,1,1,Non- Core,Value Education,,Value Education,MDT17
226,B Sc Multimedia Technologies,1,1,Non- Core,Library,,Library,MDT18
227,B Sc Multimedia Technologies,1,2,Non- Core,Tamil/Other Languages,,Tamil/Other Languages,MDT21
228,B Sc Multimedia Technologies,1,2,Non- Core,General English-II,,General English-II,MDT22
229,B Sc Multimedia Technologies,1,2,Core,Web Designing,,Web Designing,MDT23
230,B Sc Multimedia Technologies,1,2,Core,Web Designing - Practical,,Web Designing - Practical,MDT24
231,B Sc Multimedia Technologies,1,2,Core,Digital Photography,,Digital Photography,MDT25
232,B Sc Multimedia Technologies,1,2,Core,Foundation Art - Practical,,Foundation Art - Practical,MDT26
233,B Sc Multimedia Technologies,1,2,Non- Core,Environmental Studies,,Environmental Studies,MDT27
234,B Sc Multimedia Technologies,1,2,Non- Core,Library,,Library,MDT28
235,B Sc Multimedia Technologies,1,2,Core,Internship/ MiniProject,,Internship/ MiniProject,MDT29
236,B Sc Multimedia Technologies,2,1,Non- Core,Tamil/Other Languages,,Tamil/Other Languages,MDT31
237,B Sc Multimedia Technologies,2,1,Non- Core,General English-III,,General English-III,MDT32
238,B Sc Multimedia Technologies,2,1,Core,Interactive Animation Techniques,,Interactive Animation Techniques,MDT33
239,B Sc Multimedia Technologies,2,1,Core,2D Graphics & Animation,,2D Graphics & Animation,MDT34
240,B Sc Multimedia Technologies,2,1,Core,2D Graphics & Animation - Practical,,2D Graphics & Animation - Practical,MDT35
241,B Sc Multimedia Technologies,2,1,Core,Pre Production & Shooting Techniques,,Pre Production & Shooting Techniques,MDT36
242,B Sc Multimedia Technologies,2,1,Core,Interactive  Animation Techniques - Practical,,Interactive  Animation Techniques - Practical,MDT37
243,B Sc Multimedia Technologies,2,1,Non- Core,Entrepreneurship,,Entrepreneurship,MDT38
244,B Sc Multimedia Technologies,2,1,Non- Core,University Elective I:,Adipadai Tamil,University Elective I:Adipadai Tamil,MDT391
245,B Sc Multimedia Technologies,2,1,Non- Core,University Elective I:,Advance Tamil,University Elective I:Advance Tamil,MDT392
246,B Sc Multimedia Technologies,2,1,Non- Core,University Elective I:,IT Skills for Employment,University Elective I:IT Skills for Employment,MDT393
247,B Sc Multimedia Technologies,2,1,Non- Core,University Elective I:,MOOC’S,University Elective I:MOOC’S,MDT394
248,B Sc Multimedia Technologies,2,2,Non- Core,Tamil/Other Languages-IV,,Tamil/Other Languages-IV,MDT41
249,B Sc Multimedia Technologies,2,2,Non- Core,General English-IV,,General English-IV,MDT42
250,B Sc Multimedia Technologies,2,2,Core,Non Linear Editing,,Non Linear Editing,MDT43
251,B Sc Multimedia Technologies,2,2,Core,3D Design,,3D Design,MDT44
252,B Sc Multimedia Technologies,2,2,Core,3D Design - Practical,,3D Design - Practical,MDT45
253,B Sc Multimedia Technologies,2,2,Core,Advanced Art,,Advanced Art,MDT46
254,B Sc Multimedia Technologies,2,2,Core,Advanced Art - Practical,,Advanced Art - Practical,MDT47
255,B Sc Multimedia Technologies,2,2,Non- Core,University Elective II:,Adipadai Tamil,University Elective II:Adipadai Tamil,MDT481
256,B Sc Multimedia Technologies,2,2,Non- Core,University Elective II:,Advance Tamil,University Elective II:Advance Tamil,MDT482
257,B Sc Multimedia Technologies,2,2,Non- Core,University Elective II:,IT Skills for Employment,University Elective II:IT Skills for Employment,MDT483
258,B Sc Multimedia Technologies,2,2,Non- Core,University Elective II:,MOOC’S,University Elective II:MOOC’S,MDT484
259,B Sc Multimedia Technologies,2,2,Core,Internship,,Internship,MDT49
260,B Sc Multimedia Technologies,3,1,Core,Motion Graphics,,Motion Graphics,MDT51
261,B Sc Multimedia Technologies,3,1,Core,Dynamics Simulation,,Dynamics Simulation,MDT52
262,B Sc Multimedia Technologies,3,1,Core,Discipline Specific Elective I:,Concept Art,Discipline Specific Elective I:Concept Art,MDT531
263,B Sc Multimedia Technologies,3,1,Core,Discipline Specific Elective I:,Matte Painting,Discipline Specific Elective I:Matte Painting,MDT532
264,B Sc Multimedia Technologies,3,1,Core,Discipline Specific Elective I:,Visual Story tellingfor Filmand Games,Discipline Specific Elective I:Visual Story tellingfor Filmand Games,MDT533
265,B Sc Multimedia Technologies,3,1,Core,Discipline Specific Elective II:,Advanced Modeling And Texturing,Discipline Specific Elective II:Advanced Modeling And Texturing,MDT541
266,B Sc Multimedia Technologies,3,1,Core,Discipline Specific Elective II:,VR and AR Modeling,Discipline Specific Elective II:VR and AR Modeling,MDT542
267,B Sc Multimedia Technologies,3,1,Core,Discipline Specific Elective II:,Digital Sculpting andTexturing Techniques,Discipline Specific Elective II:Digital Sculpting andTexturing Techniques,MDT543
268,B Sc Multimedia Technologies,3,1,Core,Discipline Specific Elective III:,Rigging And Animation - Practical,Discipline Specific Elective III:Rigging And Animation - Practical,MDT551
269,B Sc Multimedia Technologies,3,1,Core,Discipline Specific Elective III:,Lighting And Rendering - Practical,Discipline Specific Elective III:Lighting And Rendering - Practical,MDT552
270,B Sc Multimedia Technologies,3,1,Core,Discipline Specific Elective III:,Compositing Techniques - Practical,Discipline Specific Elective III:Compositing Techniques - Practical,MDT553
271,B Sc Multimedia Technologies,3,1,Core,Motion Graphics - Practical,,Motion Graphics - Practical,MDT56
272,B Sc Multimedia Technologies,3,1,Non- Core,Career development/employability skills,,Career development/employability skills,MDT57
273,B Sc Multimedia Technologies,3,2,Core,Visualization for Multimedia,,Visualization for Multimedia,MDT61
274,B Sc Multimedia Technologies,3,2,Core,Portfolio & Presentation,,Portfolio & Presentation,MDT62
275,B Sc Multimedia Technologies,3,2,Core,Visualization for Multimedia - Practical,,Visualization for Multimedia - Practical,MDT63
276,B Sc Multimedia Technologies,3,2,Core,Discipline Specific Elective IV:,Trends in Multimedia,Discipline Specific Elective IV:Trends in Multimedia,MDT641
277,B Sc Multimedia Technologies,3,2,Core,Discipline Specific Elective IV:,Interactive Media Design and User  Experience,Discipline Specific Elective IV:Interactive Media Design and User  Experience,MDT642
278,B Sc Multimedia Technologies,3,2,Core,Discipline Specific Elective IV:,Digital Marketing and Social Media,Discipline Specific Elective IV:Digital Marketing and Social Media,MDT643
279,B Sc Multimedia Technologies,3,2,Core,Project/Dissertation,,Project/Dissertation,MDT65
280,B Sc Game Art and Design,1,1,Non- Core,Tamil/Other Languages-I,,Tamil/Other Languages-I,GAD11
281,B Sc Game Art and Design,1,1,Non- Core,General English-I,,General English-I,GAD12
282,B Sc Game Art and Design,1,1,Core,Fundamentals of Game Art,,Fundamentals of Game Art,GAD13
283,B Sc Game Art and Design,1,1,Core,Game Art - Practical,,Game Art - Practical,GAD14
284,B Sc Game Art and Design,1,1,Core,Introductionto Visual Communication,,Introductionto Visual Communication,GAD15
285,B Sc Game Art and Design,1,1,Core,ArtVisualization - Practical,,ArtVisualization - Practical,GAD16
286,B Sc Game Art and Design,1,1,Non- Core,Value Education,,Value Education,GAD17
287,B Sc Game Art and Design,1,1,Non- Core,Library,,Library,GAD18
288,B Sc Game Art and Design,1,2,Non- Core,Tamil/Other Languages,,Tamil/Other Languages,GAD21
289,B Sc Game Art and Design,1,2,Non- Core,General English-II,,General English-II,GAD22
290,B Sc Game Art and Design,1,2,Core,Design Study,,Design Study,GAD23
291,B Sc Game Art and Design,1,2,Core,Game Design- Practical,,Game Design- Practical,GAD24
292,B Sc Game Art and Design,1,2,Core,Critical Studies For Games,,Critical Studies For Games,GAD25
293,B Sc Game Art and Design,1,2,Core,Critical Studies For Games - Practical,,Critical Studies For Games - Practical,GAD26
294,B Sc Game Art and Design,1,2,Non- Core,Environmental Studies,,Environmental Studies,GAD27
295,B Sc Game Art and Design,1,2,Non- Core,Library,,Library,GAD28
296,B Sc Game Art and Design,1,2,Non- Core,Internship/ Mini Project,,Internship/ Mini Project,GAD29
297,B Sc Game Art and Design,2,1,Non- Core,Tamil/Other Languages,,Tamil/Other Languages,GAD31
298,B Sc Game Art and Design,2,1,Non- Core,General English-III,,General English-III,GAD32
299,B Sc Game Art and Design,2,1,Core,Game Production,,Game Production,GAD33
300,B Sc Game Art and Design,2,1,Core,Design & Communication for Game Design,,Design & Communication for Game Design,GAD34
301,B Sc Game Art and Design,2,1,Core,Design & Communicationfor,,Design & Communicationfor,GAD35
302,B Sc Game Art and Design,2,1,Core,Game Design - Practical,,Game Design - Practical,GAD36
303,B Sc Game Art and Design,2,1,Core,3D Digital Art For Games,,3D Digital Art For Games,GAD37
304,B Sc Game Art and Design,2,1,Core,3D Digital Art For Games - Practical,,3D Digital Art For Games - Practical,GAD38
305,B Sc Game Art and Design,2,1,Non- Core,Entrepreneurship,,Entrepreneurship,GAD39
306,B Sc Game Art and Design,2,1,Non- Core,University Elective I:,Adipadai Tamil,University Elective I:Adipadai Tamil,GAD30A
307,B Sc Game Art and Design,2,1,Non- Core,University Elective I:,Advance Tamil,University Elective I:Advance Tamil,GAD30B
308,B Sc Game Art and Design,2,1,Non- Core,University Elective I:,IT Skills for Employment,University Elective I:IT Skills for Employment,GAD30C
309,B Sc Game Art and Design,2,1,Non- Core,University Elective I:,MOOC’S,University Elective I:MOOC’S,GAD30D
310,B Sc Game Art and Design,2,2,Non- Core,Tamil/OtherLanguages,,Tamil/OtherLanguages,GAD41
311,B Sc Game Art and Design,2,2,Non- Core,GeneralEnglish-IV,,GeneralEnglish-IV,GAD42
312,B Sc Game Art and Design,2,2,Core,ProceduralModelingFor Games,,ProceduralModelingFor Games,GAD43
313,B Sc Game Art and Design,2,2,Core,LevelDesignForGame,,LevelDesignForGame,GAD44
314,B Sc Game Art and Design,2,2,Core,LevelDesignForGame-Practical,,LevelDesignForGame-Practical,GAD45
315,B Sc Game Art and Design,2,2,Core,3DCharacterDesignForGame,,3DCharacterDesignForGame,GAD46
316,B Sc Game Art and Design,2,2,Core,3DCharacterDesignForGame- Practical,,3DCharacterDesignForGame- Practical,GAD47
317,B Sc Game Art and Design,2,2,Non- Core,University Elective II:,Adipadai Tamil,University Elective II:Adipadai Tamil,GAD481
318,B Sc Game Art and Design,2,2,Non- Core,University Elective II:,Advance Tamil,University Elective II:Advance Tamil,GAD482
319,B Sc Game Art and Design,2,2,Non- Core,University Elective II:,IT Skills for Employment,University Elective II:IT Skills for Employment,GAD483
320,B Sc Game Art and Design,2,2,Non- Core,University Elective II:,MOOC’S,University Elective II:MOOC’S,GAD484
321,B Sc Game Art and Design,2,2,Core,Internship,,Internship,GAD49
322,B Sc Game Art and Design,3,1,Non- Core,Business of Media,,Business of Media,GAD51
323,B Sc Game Art and Design,3,1,Core,Portfolio & Presentation,,Portfolio & Presentation,GAD52
324,B Sc Game Art and Design,3,1,Core,Discipline Specific Elective I:,Advanced Illustration,Discipline Specific Elective I:Advanced Illustration,GAD531
325,B Sc Game Art and Design,3,1,Core,Discipline Specific Elective I:,Figure Modeling,Discipline Specific Elective I:Figure Modeling,GAD532
326,B Sc Game Art and Design,3,1,Core,Discipline Specific Elective I:,Mech Design,Discipline Specific Elective I:Mech Design,GAD533
327,B Sc Game Art and Design,3,1,Core,Discipline Specific Elective II:,Creature Sculpt,Discipline Specific Elective II:Creature Sculpt,GAD541
328,B Sc Game Art and Design,3,1,Core,Discipline Specific Elective II:,Hardsurface Sculpting,Discipline Specific Elective II:Hardsurface Sculpting,GAD542
329,B Sc Game Art and Design,3,1,Core,Discipline Specific Elective II:,3D Concept Sculpting,Discipline Specific Elective II:3D Concept Sculpting,GAD543
330,B Sc Game Art and Design,3,1,Core,Discipline Specific Elective III:,Live With Game Engine,Discipline Specific Elective III:Live With Game Engine,GAD551
331,B Sc Game Art and Design,3,1,Core,Discipline Specific Elective III:,VR Game Design,Discipline Specific Elective III:VR Game Design,GAD552
332,B Sc Game Art and Design,3,1,Core,Discipline Specific Elective III:,AR Game Design,Discipline Specific Elective III:AR Game Design,GAD553
333,B Sc Game Art and Design,3,1,Core,Portfolio & Presentation - Practical,,Portfolio & Presentation - Practical,GAD56
334,B Sc Game Art and Design,3,1,Non- Core,Career development / employability skills,,Career development / employability skills,GAD57
335,B Sc Game Art and Design,3,2,Core,Game Rigging Techniques,,Game Rigging Techniques,GAD61
336,B Sc Game Art and Design,3,2,Core,Real Time Game FX,,Real Time Game FX,GAD62
337,B Sc Game Art and Design,3,2,Core,Game Rigging Techniques - Practical,,Game Rigging Techniques - Practical,GAD63
338,B Sc Game Art and Design,3,2,Core,Discipline Specific Elective IV:,Visual Scripting,Discipline Specific Elective IV:Visual Scripting,GAD641
339,B Sc Game Art and Design,3,2,Core,Discipline Specific Elective IV:,Game Sound Design/ SFX,Discipline Specific Elective IV:Game Sound Design/ SFX,GAD642
340,B Sc Game Art and Design,3,2,Core,Discipline Specific Elective IV:,Game Cinematics,Discipline Specific Elective IV:Game Cinematics,GAD643
341,B Sc Game Art and Design,3,2,Core,Project/Dissertation,,Project/Dissertation,GAD65
342,B Sc Game Design and Development,1,1,Non- Core,Tamil/Other Languages,,Tamil/Other Languages,GDD11
343,B Sc Game Design and Development,1,1,Non- Core,General English-I,,General English-I,GDD12
344,B Sc Game Design and Development,1,1,Core,Professional Context Technology and Communication Methods,,Professional Context Technology and Communication Methods,GDD13
345,B Sc Game Design and Development,1,1,Core,Game Prototyping Practical,,Game Prototyping Practical,GDD14
346,B Sc Game Design and Development,1,1,Core,Visualization for Games,,Visualization for Games,GDD15
347,B Sc Game Design and Development,1,1,Core,Visualization for Games Practical,,Visualization for Games Practical,GDD16
348,B Sc Game Design and Development,1,1,Non- Core,Value Education,,Value Education,GDD17
349,B Sc Game Design and Development,1,1,Non- Core,Library,,Library,GDD18
350,B Sc Game Design and Development,1,2,Non- Core,Tamil/Other Languages,,Tamil/Other Languages,GDD21
351,B Sc Game Design and Development,1,2,Non- Core,General English-II,,General English-II,GDD22
352,B Sc Game Design and Development,1,2,Core,Interactive Media Development,,Interactive Media Development,GDD23
353,B Sc Game Design and Development,1,2,Core,Interactive Media Development Practical,,Interactive Media Development Practical,GDD24
354,B Sc Game Design and Development,1,2,Core,2D Game Art,,2D Game Art,GDD25
355,B Sc Game Design and Development,1,2,Core,2D Game Art Practical,,2D Game Art Practical,GDD26
356,B Sc Game Design and Development,1,2,Non- Core,Environmental Studies,,Environmental Studies,GDD27
357,B Sc Game Design and Development,1,2,Non- Core,Library,,Library,GDD28
358,B Sc Game Design and Development,1,2,Core,Internship/ Mini Project,,Internship/ Mini Project,GDD29
359,B Sc Game Design and Development,2,1,Non- Core,Tamil/Other Languages,,Tamil/Other Languages,GDD31
360,B Sc Game Design and Development,2,1,Non- Core,General English-III,,General English-III,GDD32
361,B Sc Game Design and Development,2,1,Non- Core,Game Engine-I,,Game Engine-I,GDD33
362,B Sc Game Design and Development,2,1,Core,Game Engine – I Practical,,Game Engine – I Practical,GDD34
363,B Sc Game Design and Development,2,1,Core,Web Game Development,,Web Game Development,GDD35
364,B Sc Game Design and Development,2,1,Core,Digital Modeling-I,,Digital Modeling-I,GDD36
365,B Sc Game Design and Development,2,1,Core,Digital Modeling-1 Practical,,Digital Modeling-1 Practical,GDD37
366,B Sc Game Design and Development,2,1,Non- Core,Entrepreneurship,,Entrepreneurship,GDD38
367,B Sc Game Design and Development,2,1,Non- Core,University Elective I:,Adipadai Tamil,University Elective I:Adipadai Tamil,GDD391
368,B Sc Game Design and Development,2,1,Non- Core,University Elective I:,Advance Tamil,University Elective I:Advance Tamil,GDD392
369,B Sc Game Design and Development,2,1,Non- Core,University Elective I:,IT Skills for Employment,University Elective I:IT Skills for Employment,GDD393
370,B Sc Game Design and Development,2,1,Non- Core,University Elective I:,MOOC’S,University Elective I:MOOC’S,GDD394
371,B Sc Game Design and Development,2,2,Non- Core,Tamil/Other Languages,,Tamil/Other Languages,GDD41
372,B Sc Game Design and Development,2,2,Non- Core,General English - IV,,General English - IV,GDD42
373,B Sc Game Design and Development,2,2,Core,Digital Modeling-II,,Digital Modeling-II,GDD43
374,B Sc Game Design and Development,2,2,Core,Game Networking Techniques,,Game Networking Techniques,GDD44
375,B Sc Game Design and Development,2,2,Core,Digital Modeling – II Practical,,Digital Modeling – II Practical,GDD45
376,B Sc Game Design and Development,2,2,Core,Mobile Game Development,,Mobile Game Development,GDD46
377,B Sc Game Design and Development,2,2,Core,Mobile Game Development - Practical,,Mobile Game Development - Practical,GDD47
378,B Sc Game Design and Development,2,2,Non- Core,University Elective II:,Adipadai Tamil,University Elective II:Adipadai Tamil,GDD481
379,B Sc Game Design and Development,2,2,Non- Core,University Elective II:,Advance Tamil,University Elective II:Advance Tamil,GDD482
380,B Sc Game Design and Development,2,2,Non- Core,University Elective II:,IT Skills for Employment,University Elective II:IT Skills for Employment,GDD483
381,B Sc Game Design and Development,2,2,Non- Core,University Elective II:,MOOC’S,University Elective II:MOOC’S,GDD484
382,B Sc Game Design and Development,2,2,Core,Internship,,Internship,GDD49
383,B Sc Game Design and Development,3,1,Core,Game Engine-II,,Game Engine-II,GDD51
384,B Sc Game Design and Development,3,1,Core,Game Engine–II- Practical,,Game Engine–II- Practical,GDD52
385,B Sc Game Design and Development,3,1,Core,Discipline Specific Elective I:,Animation for Games - Practical,Discipline Specific Elective I:Animation for Games - Practical,GDD531
386,B Sc Game Design and Development,3,1,Core,Discipline Specific Elective I:,Game Engine Customization - Practical,Discipline Specific Elective I:Game Engine Customization - Practical,GDD532
387,B Sc Game Design and Development,3,1,Core,Discipline Specific Elective I:,Sound Engine for Games - Practical,Discipline Specific Elective I:Sound Engine for Games - Practical,GDD533
388,B Sc Game Design and Development,3,1,Core,Discipline Specific Elective II:,Artificial Intelligence for Games,Discipline Specific Elective II:Artificial Intelligence for Games,GDD541
389,B Sc Game Design and Development,3,1,Core,Discipline Specific Elective II:,Shader Programming,Discipline Specific Elective II:Shader Programming,GDD542
390,B Sc Game Design and Development,3,1,Core,Discipline Specific Elective II:,Cinematics in Games,Discipline Specific Elective II:Cinematics in Games,GDD543
391,B Sc Game Design and Development,3,1,Core,Discipline Specific Elective III:,Emerging Trends,Discipline Specific Elective III:Emerging Trends,GDD551
392,B Sc Game Design and Development,3,1,Core,Discipline Specific Elective III:,Level Design,Discipline Specific Elective III:Level Design,GDD552
393,B Sc Game Design and Development,3,1,Core,Discipline Specific Elective III:,Game Psychology,Discipline Specific Elective III:Game Psychology,GDD553
394,B Sc Game Design and Development,3,1,Core,Practical-VI Portfolio & Presentation,,Practical-VI Portfolio & Presentation,GDD56
395,B Sc Game Design and Development,3,1,Non- Core,Career development / employability skills,,Career development / employability skills,GDD57
396,B Sc Game Design and Development,3,2,Core,Game Design Challenges,,Game Design Challenges,GDD61
397,B Sc Game Design and Development,3,2,Core,Game Testing,,Game Testing,GDD62
398,B Sc Game Design and Development,3,2,Core,Game Testing Practical,,Game Testing Practical,GDD63
399,B Sc Game Design and Development,3,2,Core,Discipline Specific Elective IV:,Advanced Game Programming,Discipline Specific Elective IV:Advanced Game Programming,GDD641
400,B Sc Game Design and Development,3,2,Core,Discipline Specific Elective IV:,Advanced Game Design,Discipline Specific Elective IV:Advanced Game Design,GDD642
401,B Sc Game Design and Development,3,2,Core,Discipline Specific Elective IV:,Game Analysis and Monetization,Discipline Specific Elective IV:Game Analysis and Monetization,GDD643
402,B Sc Game Design and Development,3,2,Core,Project/ Dissertation,,Project/ Dissertation,GDD65
403,B Sc Photography,1,1,Non- Core,Tamil/Other Languages-I,,Tamil/Other Languages-I,PHY11
404,B Sc Photography,1,1,Non- Core,General English-I,,General English-I,PHY12
405,B Sc Photography,1,1,Core,Introduction to Communication,,Introduction to Communication,PHY13
406,B Sc Photography,1,1,Core,Communication Methods - Practical,,Communication Methods - Practical,PHY14
407,B Sc Photography,1,1,Core,Fundamentals of Design And Photography,,Fundamentals of Design And Photography,PHY15
408,B Sc Photography,1,1,Core,Design And Photography Practice - Practical,,Design And Photography Practice - Practical,PHY16
409,B Sc Photography,1,1,Non- Core,Value Education,,Value Education,PHY17
410,B Sc Photography,1,1,Non- Core,Library,,Library,PHY18
411,B Sc Photography,1,2,Non- Core,Tamil/OtherLanguages,,Tamil/OtherLanguages,PHY21
412,B Sc Photography,1,2,Non- Core,General English-II,,General English-II,PHY22
413,B Sc Photography,1,2,Core,Studio LightingI (Product),,Studio LightingI (Product),PHY23
414,B Sc Photography,1,2,Core,Studio LightingI (Product) - Practical,,Studio LightingI (Product) - Practical,PHY24
415,B Sc Photography,1,2,Core,Studio Lighting II (Portraiture&Fashion),,Studio Lighting II (Portraiture&Fashion),PHY25
416,B Sc Photography,1,2,Core,Studio Lighting II(Portraiture& Fashion) - Practical,,Studio Lighting II(Portraiture& Fashion) - Practical,PHY26
417,B Sc Photography,1,2,Non- Core,Environmental Studies,,Environmental Studies,PHY27
418,B Sc Photography,1,2,Non- Core,Library,,Library,PHY28
419,B Sc Photography,1,2,Non- Core,Internship / MiniProject,,Internship / MiniProject,PHY29
420,B Sc Photography,2,1,Non- Core,Tamil/Other Languages,,Tamil/Other Languages,PHY31
421,B Sc Photography,2,1,Non- Core,General English-III,,General English-III,PHY32
422,B Sc Photography,2,1,Core,Conceptual Photography,,Conceptual Photography,PHY33
423,B Sc Photography,2,1,Core,Documentary Photography,,Documentary Photography,PHY34
424,B Sc Photography,2,1,Core,Conceptual Photography - Practical,,Conceptual Photography - Practical,PHY35
425,B Sc Photography,2,1,Core,Fundamentals of Video graphy & Audiography,,Fundamentals of Video graphy & Audiography,PHY36
426,B Sc Photography,2,1,Core,Documentary Photography - Practical,,Documentary Photography - Practical,PHY37
427,B Sc Photography,2,1,Non- Core,Entrepreneurship,,Entrepreneurship,PHY38
428,B Sc Photography,2,1,Non- Core,University Elective I:,Adipadai Tamil,University Elective I:Adipadai Tamil,PHY391
429,B Sc Photography,2,1,Non- Core,University Elective I:,Advance Tamil,University Elective I:Advance Tamil,PHY392
430,B Sc Photography,2,1,Non- Core,University Elective I:,IT Skills for Employment,University Elective I:IT Skills for Employment,PHY393
431,B Sc Photography,2,1,Non- Core,University Elective I:,MOOC’S,University Elective I:MOOC’S,PHY394
432,B Sc Photography,2,2,Non- Core,Tamil/Other Languages-IV,,Tamil/Other Languages-IV,PHY41
433,B Sc Photography,2,2,Non- Core,General English-IV,,General English-IV,PHY42
434,B Sc Photography,2,2,Core,Advanced LightingI for Photography,,Advanced LightingI for Photography,PHY43
435,B Sc Photography,2,2,Core,Advanced LightingII for Photography,,Advanced LightingII for Photography,PHY44
436,B Sc Photography,2,2,Core,Advanced LightingI for Photography - Practical,,Advanced LightingI for Photography - Practical,PHY45
437,B Sc Photography,2,2,Core,"Advertising,PR & business of media",,"Advertising,PR & business of media",PHY46
438,B Sc Photography,2,2,Core,Advanced Lighting II for Photography- Practical,,Advanced Lighting II for Photography- Practical,PHY47
439,B Sc Photography,2,2,Non- Core,University Elective II:,Adipadai Tamil,University Elective II:Adipadai Tamil,PHY481
440,B Sc Photography,2,2,Non- Core,University Elective II:,Advance Tamil,University Elective II:Advance Tamil,PHY482
441,B Sc Photography,2,2,Non- Core,University Elective II:,IT Skills for Employment,University Elective II:IT Skills for Employment,PHY483
442,B Sc Photography,2,2,Non- Core,University Elective II:,MOOC’S,University Elective II:MOOC’S,PHY484
443,B Sc Photography,2,2,Core,Internship,,Internship,PHY49
444,B Sc Photography,3,1,Non- Core,Media laws and ethics,,Media laws and ethics,PHY51
445,B Sc Photography,3,1,Core,Portfolio & Presentation,,Portfolio & Presentation,PHY52
446,B Sc Photography,3,1,Core,Discipline Specific Elective I:,Fashion Photography,Discipline Specific Elective I:Fashion Photography,PHY531
447,B Sc Photography,3,1,Core,Discipline Specific Elective I:,Wild life photography,Discipline Specific Elective I:Wild life photography,PHY532
448,B Sc Photography,3,1,Core,Discipline Specific Elective I:,Photo journalism,Discipline Specific Elective I:Photo journalism,PHY533
449,B Sc Photography,3,1,Core,Discipline Specific Elective II:,Street & Documentary Photography,Discipline Specific Elective II:Street & Documentary Photography,PHY541
450,B Sc Photography,3,1,Core,Discipline Specific Elective II:,Automobile photography,Discipline Specific Elective II:Automobile photography,PHY542
451,B Sc Photography,3,1,Core,Discipline Specific Elective II:,Macro photography,Discipline Specific Elective II:Macro photography,PHY543
452,B Sc Photography,3,1,Core,Discipline Specific Elective III:,Product Photography,Discipline Specific Elective III:Product Photography,PHY551
453,B Sc Photography,3,1,Core,Discipline Specific Elective III:,Astro photography,Discipline Specific Elective III:Astro photography,PHY552
454,B Sc Photography,3,1,Core,Discipline Specific Elective III:,Food photography,Discipline Specific Elective III:Food photography,PHY553
455,B Sc Photography,3,1,Core,Portfolio & Presentation - Practical,,Portfolio & Presentation - Practical,PHY56
456,B Sc Photography,3,1,Non- Core,Career development / employability skills,,Career development / employability skills,PHY57
457,B Sc Photography,3,2,Core,Cinematography,,Cinematography,PHY61
458,B Sc Photography,3,2,Core,Analog photography,,Analog photography,PHY62
459,B Sc Photography,3,2,Core,Cinematography-Practical,,Cinematography-Practical,PHY63
460,B Sc Photography,3,2,Core,Discipline Specific Elective IV:,Video Editing- Practical,Discipline Specific Elective IV:Video Editing- Practical,PHY641
461,B Sc Photography,3,2,Core,Discipline Specific Elective IV:,colour grading-Practical,Discipline Specific Elective IV:colour grading-Practical,PHY642
462,B Sc Photography,3,2,Core,Discipline Specific Elective IV:,Screen writing- Practical,Discipline Specific Elective IV:Screen writing- Practical,PHY643
463,B Sc Photography,3,2,Core,Project/Dissertation,,Project/Dissertation,PHY65
464,B Sc Visual effects,1,1,Non- Core,Tamil/Other Languages-I,,Tamil/Other Languages-I,VFX11
465,B Sc Visual effects,1,1,Non- Core,General English-I,,General English-I,VFX12
466,B Sc Visual effects,1,1,Core,Design & Photography,,Design & Photography,VFX13
467,B Sc Visual effects,1,1,Core,Design & Photography - Practical,,Design & Photography - Practical,VFX14
468,B Sc Visual effects,1,1,Core,Introductionto Visual Communication,,Introductionto Visual Communication,VFX15
469,B Sc Visual effects,1,1,Core,Visual Communication Methods,,Visual Communication Methods,VFX16
470,B Sc Visual effects,1,1,Non- Core,Value Education,,Value Education,VFX17
471,B Sc Visual effects,1,1,Non- Core,Library,,Library,VFX18
472,B Sc Visual effects,1,2,Non- Core,Tamil/Other Languages-II,,Tamil/Other Languages-II,VFX21
473,B Sc Visual effects,1,2,Non- Core,General English-II,,General English-II,VFX22
474,B Sc Visual effects,1,2,Core,Motion Graphics,,Motion Graphics,VFX23
475,B Sc Visual effects,1,2,Core,Motion Graphics -Practical,,Motion Graphics -Practical,VFX24
476,B Sc Visual effects,1,2,Core,Visualization for Production,,Visualization for Production,VFX25
477,B Sc Visual effects,1,2,Core,Visualization for Production - Practical,,Visualization for Production - Practical,VFX26
478,B Sc Visual effects,1,2,Non- Core,Environmental Studies,,Environmental Studies,VFX27
479,B Sc Visual effects,1,2,Non- Core,Library,,Library,VFX28
480,B Sc Visual effects,1,2,Non- Core,Internship/ Mini Project,,Internship/ Mini Project,VFX29
481,B Sc Visual effects,2,1,Non- Core,Tamil/Other Languages-III,,Tamil/Other Languages-III,VFX31
482,B Sc Visual effects,2,1,Non- Core,General English-III,,General English-III,VFX32
483,B Sc Visual effects,2,1,Non- Core,VFX ProductionI (Compositing),,VFX ProductionI (Compositing),VFX33
484,B Sc Visual effects,2,1,Core,VFX ProductionI (Compositing) - Practical,,VFX ProductionI (Compositing) - Practical,VFX34
485,B Sc Visual effects,2,1,Core,Fundamental of Videography & Audiography,,Fundamental of Videography & Audiography,VFX35
486,B Sc Visual effects,2,1,Core,VFX Production II(3D for VFX),,VFX Production II(3D for VFX),VFX36
487,B Sc Visual effects,2,1,Core,VFX Production II(3D for VFX)- Practical,,VFX Production II(3D for VFX)- Practical,VFX37
488,B Sc Visual effects,2,1,Non- Core,Entrepreneurship,,Entrepreneurship,VFX38
489,B Sc Visual effects,2,1,Non- Core,University Elective I:,Adipadai Tamil,University Elective I:Adipadai Tamil,VFX391
490,B Sc Visual effects,2,1,Non- Core,University Elective I:,Advance Tamil,University Elective I:Advance Tamil,VFX392
491,B Sc Visual effects,2,1,Non- Core,University Elective I:,IT Skills for Employment,University Elective I:IT Skills for Employment,VFX393
492,B Sc Visual effects,2,1,Non- Core,University Elective I:,MOOC’S,University Elective I:MOOC’S,VFX394
493,B Sc Visual effects,2,2,Non- Core,Tamil/Other Languages-IV,,Tamil/Other Languages-IV,VFX41
494,B Sc Visual effects,2,2,Non- Core,General English-IV,,General English-IV,VFX42
495,B Sc Visual effects,2,2,Core,Video Editing,,Video Editing,VFX43
496,B Sc Visual effects,2,2,Core,VFX Production III (FX for VFX),,VFX Production III (FX for VFX),VFX44
497,B Sc Visual effects,2,2,Core,Video editing & FX for VFX - Practical,,Video editing & FX for VFX - Practical,VFX45
498,B Sc Visual effects,2,2,Core,VFX Production IV (Matchmove/ Rotomation & CG Compositing),,VFX Production IV (Matchmove/ Rotomation & CG Compositing),VFX46
499,B Sc Visual effects,2,2,Core,Internship,,Internship,VFX47
500,B Sc Visual effects,2,2,Non- Core,University Elective II:,Adipadai Tamil,University Elective II:Adipadai Tamil,VFX481
501,B Sc Visual effects,2,2,Non- Core,University Elective II:,Advance Tamil,University Elective II:Advance Tamil,VFX482
502,B Sc Visual effects,2,2,Non- Core,University Elective II:,IT Skills for Employment,University Elective II:IT Skills for Employment,VFX483
503,B Sc Visual effects,2,2,Non- Core,University Elective II:,MOOC’S,University Elective II:MOOC’S,VFX484
504,B Sc Visual effects,3,1,Non- Core,Busines of Media,,Busines of Media,VFX51
505,B Sc Visual effects,3,1,Non- Core,Portfolio & Presentation,,Portfolio & Presentation,VFX52
506,B Sc Visual effects,3,1,Core,Compositing:,1. Rotoscopy,Compositing:1. Rotoscopy,VFX531
507,B Sc Visual effects,3,1,Core,Compositing:,2. Keying,Compositing:2. Keying,VFX532
508,B Sc Visual effects,3,1,Core,Compositing:,3. Tracking,Compositing:3. Tracking,VFX533
509,B Sc Visual effects,3,1,Core,CGI for Visual Effects:,1. Modelling & Texturing,CGI for Visual Effects:1. Modelling & Texturing,VFX541
510,B Sc Visual effects,3,1,Core,CGI for Visual Effects:,2. Lighting & Rendering,CGI for Visual Effects:2. Lighting & Rendering,VFX542
511,B Sc Visual effects,3,1,Core,CGI for Visual Effects:,3. Rigging & Animation,CGI for Visual Effects:3. Rigging & Animation,VFX543
512,B Sc Visual effects,3,1,Core,Matchmove & Rotomation:,1. Camera tracking,Matchmove & Rotomation:1. Camera tracking,VFX551
513,B Sc Visual effects,3,1,Core,Matchmove & Rotomation:,2. ObjectTracking,Matchmove & Rotomation:2. ObjectTracking,VFX552
514,B Sc Visual effects,3,1,Core,Matchmove & Rotomation:,3. Rotomation,Matchmove & Rotomation:3. Rotomation,VFX553
515,B Sc Visual effects,3,1,Core,Practical-VI Portfolio & Presentation,,Practical-VI Portfolio & Presentation,VFX56
516,B Sc Visual effects,3,1,Non- Core,Career development / employability skills,,Career development / employability skills,VFX57
517,B Sc Visual effects,3,2,Non- Core,Project Management,,Project Management,VFX61
518,B Sc Visual effects,3,2,Core,Emerging Technologies and Trendsin VFX.,,Emerging Technologies and Trendsin VFX.,VFX62
519,B Sc Visual effects,3,2,Core,Game Engine for VFX - Practical,,Game Engine for VFX - Practical,VFX63
520,B Sc Visual effects,3,2,Core,FX & Advanced Compositing:,1. FX,FX & Advanced Compositing:1. FX,VFX641
521,B Sc Visual effects,3,2,Core,FX & Advanced Compositing:,2. CFX,FX & Advanced Compositing:2. CFX,VFX642
522,B Sc Visual effects,3,2,Core,FX & Advanced Compositing:,3. CG & Live Action Compositing,FX & Advanced Compositing:3. CG & Live Action Compositing,VFX643
523,B Sc Visual effects,3,2,Core,Project/Dissertation,,Project/Dissertation,VFX65
524,M Sc Game Technology,1,1,Core,Advanced Game Development,,Advanced Game Development,MGT11
525,M Sc Game Technology,1,1,Core,Advanced Game Design and Analysis,,Advanced Game Design and Analysis,MGT12
526,M Sc Game Technology,1,1,Core,Game Conceptualization,,Game Conceptualization,MGT13
527,M Sc Game Technology,1,1,Core,Game Programming,,Game Programming,MGT14
528,M Sc Game Technology,1,1,Core,Game Programming -Practical,,Game Programming -Practical,MGT15
529,M Sc Game Technology,1,1,Core,Discipline Specific Elective I:,1. History of Artin Games,Discipline Specific Elective I:1. History of Artin Games,MGT161
530,M Sc Game Technology,1,1,Core,Discipline Specific Elective I:,2. Game Mathand Physics,Discipline Specific Elective I:2. Game Mathand Physics,MGT162
531,M Sc Game Technology,1,1,Core,Discipline Specific Elective I:,3. Advanced Art for Game Character,Discipline Specific Elective I:3. Advanced Art for Game Character,MGT163
532,M Sc Game Technology,1,1,Non- Core,Library,,Library,MGT17
533,M Sc Game Technology,1,2,Core,2D Art,,2D Art,MGT21
534,M Sc Game Technology,1,2,Core,Advanced 3D Design Techniques,,Advanced 3D Design Techniques,MGT22
535,M Sc Game Technology,1,2,Core,Specialized Game Engine-I,,Specialized Game Engine-I,MGT23
536,M Sc Game Technology,1,2,Core,Web Game Programming - Practical,,Web Game Programming - Practical,MGT24
537,M Sc Game Technology,1,2,Core,Specialized Game EngineI - Practical,,Specialized Game EngineI - Practical,MGT25
538,M Sc Game Technology,1,2,Core,Discipline Specific Elective II:,1. Game Engine Specialization,Discipline Specific Elective II:1. Game Engine Specialization,MGT261
539,M Sc Game Technology,1,2,Core,Discipline Specific Elective II:,2. Game Level Designing,Discipline Specific Elective II:2. Game Level Designing,MGT262
540,M Sc Game Technology,1,2,Core,Discipline Specific Elective II:,3. Shader Programming,Discipline Specific Elective II:3. Shader Programming,MGT263
541,M Sc Game Technology,1,2,Core,Discipline Specific Elective III:,1. Digital Cinematography - Practical,Discipline Specific Elective III:1. Digital Cinematography - Practical,MGT271
542,M Sc Game Technology,1,2,Core,Discipline Specific Elective III:,2. 2D Animation Techniques- Practical,Discipline Specific Elective III:2. 2D Animation Techniques- Practical,MGT272
543,M Sc Game Technology,1,2,Core,Discipline Specific Elective III:,3. Graphic Designing - Practical,Discipline Specific Elective III:3. Graphic Designing - Practical,MGT273
544,M Sc Game Technology,1,2,Non- Core,Self Learning courses(SLC) - MOOCs**,,Self Learning courses(SLC) - MOOCs**,MGT28
545,M Sc Game Technology,2,1,Core,Specialized Game Engine - II,,Specialized Game Engine - II,MGT31
546,M Sc Game Technology,2,1,Core,Advanced Mobile Game Development,,Advanced Mobile Game Development,MGT32
547,M Sc Game Technology,2,1,Core,Emerging Technologies in Game Development,,Emerging Technologies in Game Development,MGT33
548,M Sc Game Technology,2,1,Core,Mini project,,Mini project,MGT34
549,M Sc Game Technology,2,1,Core,Specialized Game Engine - II - Practicals,,Specialized Game Engine - II - Practicals,MGT35
550,M Sc Game Technology,2,1,Core,Discipline Specific Elective IV:,1. Advanced Game Programming,Discipline Specific Elective IV:1. Advanced Game Programming,MGT361
551,M Sc Game Technology,2,1,Core,Discipline Specific Elective IV:,2. Advanced Game Art,Discipline Specific Elective IV:2. Advanced Game Art,MGT362
552,M Sc Game Technology,2,1,Core,Discipline Specific Elective IV:,3. Artificial Intelligence for Games,Discipline Specific Elective IV:3. Artificial Intelligence for Games,MGT363
553,M Sc Game Technology,2,1,Core,Discipline Specific Elective V:,1. Video & Audio Editing,Discipline Specific Elective V:1. Video & Audio Editing,MGT371
554,M Sc Game Technology,2,1,Core,Discipline Specific Elective V:,2. Lighting and Rendering,Discipline Specific Elective V:2. Lighting and Rendering,MGT372
555,M Sc Game Technology,2,1,Core,Discipline Specific Elective V:,3. Matte Painting,Discipline Specific Elective V:3. Matte Painting,MGT373
556,M Sc Game Technology,2,1,Non- Core,Self Learning courses(SLC) - MOOCs**,,Self Learning courses(SLC) - MOOCs**,MGT38
557,M Sc Game Technology,2,2,Core,Dissertation/ Internship,,Dissertation/ Internship,MGT41
558,M Sc Multimedia,1,1,Core,Introduction to Communication,,Introduction to Communication,MMM11
559,M Sc Multimedia,1,1,Core,Visual Presentation,,Visual Presentation,MMM12
560,M Sc Multimedia,1,1,Core,Graphic Designing,,Graphic Designing,MMM13
561,M Sc Multimedia,1,1,Core,Scripting & Story boarding,,Scripting & Story boarding,MMM14
562,M Sc Multimedia,1,1,Core,Graphic Designing - Practical,,Graphic Designing - Practical,MMM15
563,M Sc Multimedia,1,1,Core,Discipline Specific Elective I:,1. Image Editing Techniques – Practicalor,Discipline Specific Elective I:1. Image Editing Techniques – Practicalor,MMM161
564,M Sc Multimedia,1,1,Core,Discipline Specific Elective I:,2. Matte Painting – Practicalor,Discipline Specific Elective I:2. Matte Painting – Practicalor,MMM162
565,M Sc Multimedia,1,1,Core,Discipline Specific Elective I:,2.Digital Marketing - Practical,Discipline Specific Elective I:2.Digital Marketing - Practical,MMM163
566,M Sc Multimedia,1,1,Non- Core,Library,,Library,MMM17
567,M Sc Multimedia,1,2,Core,2D Digital Animation Techniques,,2D Digital Animation Techniques,MMM21
568,M Sc Multimedia,1,2,Core,Advanced 3D Design and Visualization Methods,,Advanced 3D Design and Visualization Methods,MMM22
569,M Sc Multimedia,1,2,Core,Explainer Video Production,,Explainer Video Production,MMM23
570,M Sc Multimedia,1,2,Core,Video & Audio Editing,,Video & Audio Editing,MMM24
571,M Sc Multimedia,1,2,Core,2D Digital AnimationTechniques - Practical,,2D Digital AnimationTechniques - Practical,MMM25
572,M Sc Multimedia,1,2,Core,Discipline Specific Elective II:,1. Visual Effects,Discipline Specific Elective II:1. Visual Effects,MMM261
573,M Sc Multimedia,1,2,Core,Discipline Specific Elective II:,2. Interactive Motion Designfor User Experience,Discipline Specific Elective II:2. Interactive Motion Designfor User Experience,MMM262
574,M Sc Multimedia,1,2,Core,Discipline Specific Elective II:,3. Branding and Identity Design Strategy,Discipline Specific Elective II:3. Branding and Identity Design Strategy,MMM263
575,M Sc Multimedia,1,2,Core,Discipline Specific Elective III:,1. ARF undamentals and Applications,Discipline Specific Elective III:1. ARF undamentals and Applications,MMM271
576,M Sc Multimedia,1,2,Core,Discipline Specific Elective III:,2. Fundamentals of VR Technology,Discipline Specific Elective III:2. Fundamentals of VR Technology,MMM272
577,M Sc Multimedia,1,2,Core,Discipline Specific Elective III:,3. Game Engine Integration for 2D Animation,Discipline Specific Elective III:3. Game Engine Integration for 2D Animation,MMM273
578,M Sc Multimedia,1,2,Non- Core,Self Learning courses(SLC) - MOOCs**,,Self Learning courses(SLC) - MOOCs**,MMM28
579,M Sc Multimedia,2,1,Core,Modeling &Texturing,,Modeling &Texturing,MMM31
580,M Sc Multimedia,2,1,Core,Advanced Rigging &Animation,,Advanced Rigging &Animation,MMM32
581,M Sc Multimedia,2,1,Core,Advanced Lighting &Rendering,,Advanced Lighting &Rendering,MMM33
582,M Sc Multimedia,2,1,Core,Digital Cinematography,,Digital Cinematography,MMM34
583,M Sc Multimedia,2,1,Core,Modeling & Texturing- Practical,,Modeling & Texturing- Practical,MMM35
584,M Sc Multimedia,2,1,Core,Discipline Specific Elective IV:,1. Advanced Visual Effects,Discipline Specific Elective IV:1. Advanced Visual Effects,MMM361
585,M Sc Multimedia,2,1,Core,Discipline Specific Elective IV:,2. Dynamic Simulation,Discipline Specific Elective IV:2. Dynamic Simulation,MMM362
586,M Sc Multimedia,2,1,Core,Discipline Specific Elective IV:,3. 3D Printing and Additive Manufacturingin Design,Discipline Specific Elective IV:3. 3D Printing and Additive Manufacturingin Design,MMM363
587,M Sc Multimedia,2,1,Core,Discipline Specific Elective V:,1. Interactive Game UI and UX Design,Discipline Specific Elective V:1. Interactive Game UI and UX Design,MMM371
588,M Sc Multimedia,2,1,Core,Discipline Specific Elective V:,2. Interactive Cinematic Techniques for Game Environments,Discipline Specific Elective V:2. Interactive Cinematic Techniques for Game Environments,MMM372
589,M Sc Multimedia,2,1,Core,Discipline Specific Elective V:,3. Game Art Fundamentals and Aesthetics,Discipline Specific Elective V:3. Game Art Fundamentals and Aesthetics,MMM373
590,M Sc Multimedia,2,1,Non- Core,Self Learning courses(SLC) - MOOCs**,,Self Learning courses(SLC) - MOOCs**,MMM38
591,M Sc Multimedia,2,2,Non- Core,Dissertation/ Internship,,Dissertation/ Internship,MMM41
592,PGD 3D Animation,1,1,Core,Foundation Studies,,Foundation Studies,PG3D1
593,PGD 3D Animation,1,1,Core,Idea Generation & Development,,Idea Generation & Development,PG3D2
594,PGD 3D Animation,1,1,Core,Specialist Practice I - Art for Animation,,Specialist Practice I - Art for Animation,PG3D3
595,PGD 3D Animation,1,1,Core,Specialist Practice II - CGI Foundation for Animation,,Specialist Practice II - CGI Foundation for Animation,PG3D4
596,PGD 3D Animation,1,1,Core,Specialist Practice III - Postproduction for Animation,,Specialist Practice III - Postproduction for Animation,PG3D5
597,PGD 3D Animation,1,1,Core,Major Project,,Major Project,PG3D6
598,PGD Visual Effects,1,1,Core,Foundation Studies ,,Foundation Studies ,PGVFX1
599,PGD Visual Effects,1,1,Core,Idea Generation & Development,,Idea Generation & Development,PGVFX2
600,PGD Visual Effects,1,1,Core,Specialist Practice I - Compositing for VFX,,Specialist Practice I - Compositing for VFX,PGVFX3
601,PGD Visual Effects,1,1,Core,Specialist Practice II - CGI Foundation for VFX,,Specialist Practice II - CGI Foundation for VFX,PGVFX4
602,PGD Visual Effects,1,1,Core,Specialist Practice III - Effects Animation for VFX,,Specialist Practice III - Effects Animation for VFX,PGVFX5
603,PGD Visual Effects,1,1,Core,Major Project,,Major Project,PGVFX6
604,PGD Game Design,1,1,Core,Foundation Studies,,Foundation Studies,PGGDS1
605,PGD Game Design,1,1,Core,Idea Generation & Development,,Idea Generation & Development,PGGDS2
606,PGD Game Design,1,1,Core,Specialist Practice I - Game engine fundamentals,,Specialist Practice I - Game engine fundamentals,PGGDS3
607,PGD Game Design,1,1,Core,Specialist Practice II - 2D and 3D Game making techniques,,Specialist Practice II - 2D and 3D Game making techniques,PGGDS4
608,PGD Game Design,1,1,Core,Specialist Practice III - Next Gen Techniques,,Specialist Practice III - Next Gen Techniques,PGGDS5
609,PGD Game Design,1,1,Core,Major Project,,Major Project,PGGDS6
610,PGD Multimedia,1,1,Core,Foundation Studies,,Foundation Studies,PGMMT1
611,PGD Multimedia,1,1,Core,Pre Visualization,,Pre Visualization,PGMMT2
612,PGD Multimedia,1,1,Core,Specialist Practice I - Graphics,,Specialist Practice I - Graphics,PGMMT3
613,PGD Multimedia,1,1,Core,Specialist Practice II - Web & E-Learning,,Specialist Practice II - Web & E-Learning,PGMMT4
614,PGD Multimedia,1,1,Core,Specialist Practice III - 3D & Motion Graphics,,Specialist Practice III - 3D & Motion Graphics,PGMMT5
615,PGD Multimedia,1,1,Core,Media Production,,Media Production,PGMMT6
616,PGD UI/UX Design,1,1,Core,Foundation Studies,,Foundation Studies,PGUI1
617,PGD UI/UX Design,1,1,Core,Conceptualisation,,Conceptualisation,PGUI2
618,PGD UI/UX Design,1,1,Core,UI:Visual Design,,UI:Visual Design,PGUI3
619,PGD UI/UX Design,1,1,Core,UI:Development,,UI:Development,PGUI4
620,PGD UI/UX Design,1,1,Core,Application Prototyping,,Application Prototyping,PGUI5
621,PGD UI/UX Design,1,1,Core,Usability and User Experience,,Usability and User Experience,PGUI6`;

export const parseCurriculum = (): Module[] => {
    const lines = CURRICULUM_CSV.split('\n');
    const modules: Module[] = [];
    let insideQuote = false;
    let currentLine = "";

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim() && !insideQuote) continue;

        const quoteCount = (line.match(/"/g) || []).length;
        if (!insideQuote) {
             if (quoteCount % 2 !== 0) {
                 insideQuote = true;
                 currentLine = line;
             } else {
                 processRow(line, modules);
             }
        } else {
             currentLine += "\n" + line;
             if (quoteCount % 2 !== 0) {
                 insideQuote = false;
                 processRow(currentLine, modules);
                 currentLine = "";
             }
        }
    }
    return modules;
};

function processRow(line: string, modules: Module[]) {
    const cols: string[] = [];
    let current = '';
    let inQuote = false;
    
    for (let j = 0; j < line.length; j++) {
        const c = line[j];
        if (c === '"') {
            inQuote = !inQuote;
        } else if (c === ',' && !inQuote) {
            cols.push(current.trim());
            current = '';
        } else {
            current += c;
        }
    }
    cols.push(current.trim());

    if (cols.length < 9) return;
    
    const code = cols[8].replace(/^"|"$/g, '').trim(); 
    if (!code) return;

    const fullTitle = cols[7].replace(/^"|"$/g, '').trim();
    const shortTitle = cols[5].replace(/^"|"$/g, '').trim();

    modules.push({
        code: code,
        title: fullTitle || shortTitle,
        programTitle: cols[1].replace(/^"|"$/g, '').trim(),
        year: parseInt(cols[2]) || 1,
        sem: parseInt(cols[3]) || 1,
        type: (cols[4].replace(/^"|"$/g, '').trim()) as any,
        category: cols[6]?.replace(/^"|"$/g, '').trim() || undefined
    });
}

export const parseUsers = (): User[] => {
    const users: User[] = [];

    // Parse Faculty
    const facultyLines = FACULTY_CSV.split('\n');
    for (let i = 1; i < facultyLines.length; i++) {
        const line = facultyLines[i].trim();
        if (!line) continue;
        const cols = line.split(',');
        if (cols.length < 5) continue;
        users.push({
            id: cols[0].trim(),
            name: cols[1].trim(),
            email: cols[3].trim(),
            role: cols[4].trim() as Role, 
            programId: '',
            password: cols[0].trim(),
            profilePicture: ''
        });
    }

    // Parse Students
    const studentLines = STUDENT_CSV.split('\n');
    for (let i = 1; i < studentLines.length; i++) {
        const line = studentLines[i].trim();
        if (!line) continue;
        const cols = line.split(',');
        if (cols.length < 6) continue;
        
        // Handle special mapping for PGPP -> PGD
        let progId = cols[2].trim();
        if (progId.includes('PGPP')) progId = progId.replace('PGPP', 'PGD');

        users.push({
            id: cols[0].trim(),
            name: cols[1].trim(),
            email: cols[4].trim(),
            role: cols[5].trim() as Role,
            programId: progId,
            year: parseInt(cols[3].trim()),
            password: cols[0].trim(),
            profilePicture: ''
        });
    }

    return users;
};