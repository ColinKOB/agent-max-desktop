------------------------------------
Translated Report (Full Report Below)
-------------------------------------

Process:               Agent Max [78226]
Path:                  /Applications/Agent Max.app/Contents/MacOS/Agent Max
Identifier:            com.agentmax.desktop
Version:               1.0.0 (1.0.0)
Code Type:             ARM-64 (Native)
Parent Process:        launchd [1]
User ID:               501

Date/Time:             2025-11-03 06:47:09.9185 -0500
OS Version:            macOS 15.6 (24G84)
Report Version:        12
Anonymous UUID:        39FCB261-65C4-9496-3225-D347F930A398

Sleep/Wake UUID:       8AB60493-BC8A-40E5-A537-184816CD68CC

Time Awake Since Boot: 830000 seconds
Time Since Wake:       4263 seconds

System Integrity Protection: enabled

Crashed Thread:        0  Dispatch queue: com.apple.main-thread

Exception Type:        EXC_BREAKPOINT (SIGTRAP)
Exception Codes:       0x0000000000000001, 0x00000001963b0bdc

Termination Reason:    Namespace SIGNAL, Code 5 Trace/BPT trap: 5
Terminating Process:   exc handler [78226]

Thread 0 Crashed::  Dispatch queue: com.apple.main-thread
0   libsystem_pthread.dylib       	       0x1963b0bdc pthread_jit_write_protect_np + 520
1   Electron Framework            	       0x1121f1264 node::GetArrayBufferAllocator(node::IsolateData*) + 36551932
2   Electron Framework            	       0x10efae3f4 v8::internal::ThreadIsolation::Initialize(v8::ThreadIsolatedAllocator*) + 72
3   Electron Framework            	       0x10f199c90 v8::internal::V8::InitializePlatformForTesting(v8::Platform*) + 660
4   Electron Framework            	       0x10eef28f8 v8::V8::Initialize(int) + 28
5   Electron Framework            	       0x1123886e4 node::GetArrayBufferAllocator(node::IsolateData*) + 38220156
6   Electron Framework            	       0x112385e38 node::GetArrayBufferAllocator(node::IsolateData*) + 38209744
7   Electron Framework            	       0x10ddb53fc v8::Signature::New(v8::Isolate*, v8::Local<v8::FunctionTemplate>) + 10376
8   Electron Framework            	       0x10ddb5134 v8::Signature::New(v8::Isolate*, v8::Local<v8::FunctionTemplate>) + 9664
9   Electron Framework            	       0x10dd9b758 v8::internal::compiler::SLVerifierHintParametersOf(v8::internal::compiler::Operator const*) + 68164
10  Electron Framework            	       0x11014763c node::GetArrayBufferAllocator(node::IsolateData*) + 2302164
11  Electron Framework            	       0x11014aff4 node::GetArrayBufferAllocator(node::IsolateData*) + 2316940
12  Electron Framework            	       0x110146fb0 node::GetArrayBufferAllocator(node::IsolateData*) + 2300488
13  Electron Framework            	       0x10dfe3050 v8::internal::compiler::BasicBlock::set_loop_header(v8::internal::compiler::BasicBlock*) + 13948
14  Electron Framework            	       0x10dfe41b8 v8::internal::compiler::BasicBlock::set_loop_header(v8::internal::compiler::BasicBlock*) + 18404
15  Electron Framework            	       0x10dfe3fe8 v8::internal::compiler::BasicBlock::set_loop_header(v8::internal::compiler::BasicBlock*) + 17940
16  Electron Framework            	       0x10dfe2894 v8::internal::compiler::BasicBlock::set_loop_header(v8::internal::compiler::BasicBlock*) + 11968
17  Electron Framework            	       0x10dfe2a34 v8::internal::compiler::BasicBlock::set_loop_header(v8::internal::compiler::BasicBlock*) + 12384
18  Electron Framework            	       0x10dcb22f0 ElectronMain + 128
19  dyld                          	       0x19600eb98 start + 6076

Thread 1:
0   libsystem_pthread.dylib       	       0x1963aab6c start_wqthread + 0

Thread 2:
0   libsystem_pthread.dylib       	       0x1963aab6c start_wqthread + 0

Thread 3:
0   libsystem_pthread.dylib       	       0x1963aab6c start_wqthread + 0

Thread 4:: ThreadPoolServiceThread
0   libsystem_kernel.dylib        	       0x19637995c kevent64 + 8
1   Electron Framework            	       0x111043efc node::GetArrayBufferAllocator(node::IsolateData*) + 18016660
2   Electron Framework            	       0x111043730 node::GetArrayBufferAllocator(node::IsolateData*) + 18014664
3   Electron Framework            	       0x110ff0fb0 node::GetArrayBufferAllocator(node::IsolateData*) + 17676872
4   Electron Framework            	       0x110fb7b98 node::GetArrayBufferAllocator(node::IsolateData*) + 17442352
5   Electron Framework            	       0x1110121bc node::GetArrayBufferAllocator(node::IsolateData*) + 17812564
6   Electron Framework            	       0x110ffab54 node::GetArrayBufferAllocator(node::IsolateData*) + 17716716
7   Electron Framework            	       0x1110122fc node::GetArrayBufferAllocator(node::IsolateData*) + 17812884
8   Electron Framework            	       0x111025a10 node::GetArrayBufferAllocator(node::IsolateData*) + 17892520
9   libsystem_pthread.dylib       	       0x1963afc0c _pthread_start + 136
10  libsystem_pthread.dylib       	       0x1963aab80 thread_start + 8

Thread 5:: ThreadPoolForegroundWorker
0   libsystem_kernel.dylib        	       0x19636dc34 mach_msg2_trap + 8
1   libsystem_kernel.dylib        	       0x1963803a0 mach_msg2_internal + 76
2   libsystem_kernel.dylib        	       0x196376764 mach_msg_overwrite + 484
3   libsystem_kernel.dylib        	       0x19636dfa8 mach_msg + 24
4   Electron Framework            	       0x11103d1bc node::GetArrayBufferAllocator(node::IsolateData*) + 17988692
5   Electron Framework            	       0x110fcfcb8 node::GetArrayBufferAllocator(node::IsolateData*) + 17540944
6   Electron Framework            	       0x11100b7c4 node::GetArrayBufferAllocator(node::IsolateData*) + 17785436
7   Electron Framework            	       0x11100b130 node::GetArrayBufferAllocator(node::IsolateData*) + 17783752
8   Electron Framework            	       0x11100b008 node::GetArrayBufferAllocator(node::IsolateData*) + 17783456
9   Electron Framework            	       0x111025a10 node::GetArrayBufferAllocator(node::IsolateData*) + 17892520
10  libsystem_pthread.dylib       	       0x1963afc0c _pthread_start + 136
11  libsystem_pthread.dylib       	       0x1963aab80 thread_start + 8

Thread 6:: ThreadPoolBackgroundWorker
0   libsystem_kernel.dylib        	       0x19636dc34 mach_msg2_trap + 8
1   libsystem_kernel.dylib        	       0x1963803a0 mach_msg2_internal + 76
2   libsystem_kernel.dylib        	       0x196376764 mach_msg_overwrite + 484
3   libsystem_kernel.dylib        	       0x19636dfa8 mach_msg + 24
4   Electron Framework            	       0x11103d1bc node::GetArrayBufferAllocator(node::IsolateData*) + 17988692
5   Electron Framework            	       0x110fcfcb8 node::GetArrayBufferAllocator(node::IsolateData*) + 17540944
6   Electron Framework            	       0x11100a918 node::GetArrayBufferAllocator(node::IsolateData*) + 17781680
7   Electron Framework            	       0x11100b274 node::GetArrayBufferAllocator(node::IsolateData*) + 17784076
8   Electron Framework            	       0x11100b0ac node::GetArrayBufferAllocator(node::IsolateData*) + 17783620
9   Electron Framework            	       0x11100b03c node::GetArrayBufferAllocator(node::IsolateData*) + 17783508
10  Electron Framework            	       0x111025a10 node::GetArrayBufferAllocator(node::IsolateData*) + 17892520
11  libsystem_pthread.dylib       	       0x1963afc0c _pthread_start + 136
12  libsystem_pthread.dylib       	       0x1963aab80 thread_start + 8

Thread 7:: ThreadPoolForegroundWorker
0   libsystem_kernel.dylib        	       0x19636dc34 mach_msg2_trap + 8
1   libsystem_kernel.dylib        	       0x1963803a0 mach_msg2_internal + 76
2   libsystem_kernel.dylib        	       0x196376764 mach_msg_overwrite + 484
3   libsystem_kernel.dylib        	       0x19636dfa8 mach_msg + 24
4   Electron Framework            	       0x11103d1bc node::GetArrayBufferAllocator(node::IsolateData*) + 17988692
5   Electron Framework            	       0x110fcfcb8 node::GetArrayBufferAllocator(node::IsolateData*) + 17540944
6   Electron Framework            	       0x11100a918 node::GetArrayBufferAllocator(node::IsolateData*) + 17781680
7   Electron Framework            	       0x11100b274 node::GetArrayBufferAllocator(node::IsolateData*) + 17784076
8   Electron Framework            	       0x11100b130 node::GetArrayBufferAllocator(node::IsolateData*) + 17783752
9   Electron Framework            	       0x11100b008 node::GetArrayBufferAllocator(node::IsolateData*) + 17783456
10  Electron Framework            	       0x111025a10 node::GetArrayBufferAllocator(node::IsolateData*) + 17892520
11  libsystem_pthread.dylib       	       0x1963afc0c _pthread_start + 136
12  libsystem_pthread.dylib       	       0x1963aab80 thread_start + 8

Thread 8:: Chrome_IOThread
0   libsystem_kernel.dylib        	       0x19637995c kevent64 + 8
1   Electron Framework            	       0x111043efc node::GetArrayBufferAllocator(node::IsolateData*) + 18016660
2   Electron Framework            	       0x111043730 node::GetArrayBufferAllocator(node::IsolateData*) + 18014664
3   Electron Framework            	       0x110ff0fb0 node::GetArrayBufferAllocator(node::IsolateData*) + 17676872
4   Electron Framework            	       0x110fb7b98 node::GetArrayBufferAllocator(node::IsolateData*) + 17442352
5   Electron Framework            	       0x1110121bc node::GetArrayBufferAllocator(node::IsolateData*) + 17812564
6   Electron Framework            	       0x11014bdcc node::GetArrayBufferAllocator(node::IsolateData*) + 2320484
7   Electron Framework            	       0x1110122fc node::GetArrayBufferAllocator(node::IsolateData*) + 17812884
8   Electron Framework            	       0x111025a10 node::GetArrayBufferAllocator(node::IsolateData*) + 17892520
9   libsystem_pthread.dylib       	       0x1963afc0c _pthread_start + 136
10  libsystem_pthread.dylib       	       0x1963aab80 thread_start + 8

Thread 9:: MemoryInfra
0   libsystem_kernel.dylib        	       0x19636dc34 mach_msg2_trap + 8
1   libsystem_kernel.dylib        	       0x1963803a0 mach_msg2_internal + 76
2   libsystem_kernel.dylib        	       0x196376764 mach_msg_overwrite + 484
3   libsystem_kernel.dylib        	       0x19636dfa8 mach_msg + 24
4   Electron Framework            	       0x11103d1bc node::GetArrayBufferAllocator(node::IsolateData*) + 17988692
5   Electron Framework            	       0x110fcfb94 node::GetArrayBufferAllocator(node::IsolateData*) + 17540652
6   Electron Framework            	       0x110f90284 node::GetArrayBufferAllocator(node::IsolateData*) + 17280284
7   Electron Framework            	       0x110ff0fb0 node::GetArrayBufferAllocator(node::IsolateData*) + 17676872
8   Electron Framework            	       0x110fb7b98 node::GetArrayBufferAllocator(node::IsolateData*) + 17442352
9   Electron Framework            	       0x1110121bc node::GetArrayBufferAllocator(node::IsolateData*) + 17812564
10  Electron Framework            	       0x1110122fc node::GetArrayBufferAllocator(node::IsolateData*) + 17812884
11  Electron Framework            	       0x111025a10 node::GetArrayBufferAllocator(node::IsolateData*) + 17892520
12  libsystem_pthread.dylib       	       0x1963afc0c _pthread_start + 136
13  libsystem_pthread.dylib       	       0x1963aab80 thread_start + 8

Thread 10:
0   libsystem_kernel.dylib        	       0x196373d04 kevent + 8
1   Electron Framework            	       0x10dcb1d38 uv_free_interface_addresses + 2180
2   Electron Framework            	       0x10dca1068 uv_run + 272
3   Electron Framework            	       0x11490fdb0 node::OnFatalError(char const*, char const*) + 443784
4   libsystem_pthread.dylib       	       0x1963afc0c _pthread_start + 136
5   libsystem_pthread.dylib       	       0x1963aab80 thread_start + 8

Thread 11:
0   libsystem_kernel.dylib        	       0x1963713cc __psynch_cvwait + 8
1   libsystem_pthread.dylib       	       0x1963b00e0 _pthread_cond_wait + 984
2   Electron Framework            	       0x10dcaca44 uv_cond_wait + 12
3   Electron Framework            	       0x11490dd28 node::OnFatalError(char const*, char const*) + 435456
4   libsystem_pthread.dylib       	       0x1963afc0c _pthread_start + 136
5   libsystem_pthread.dylib       	       0x1963aab80 thread_start + 8

Thread 12:
0   libsystem_kernel.dylib        	       0x1963713cc __psynch_cvwait + 8
1   libsystem_pthread.dylib       	       0x1963b00e0 _pthread_cond_wait + 984
2   Electron Framework            	       0x10dcaca44 uv_cond_wait + 12
3   Electron Framework            	       0x11490dd28 node::OnFatalError(char const*, char const*) + 435456
4   libsystem_pthread.dylib       	       0x1963afc0c _pthread_start + 136
5   libsystem_pthread.dylib       	       0x1963aab80 thread_start + 8

Thread 13:
0   libsystem_kernel.dylib        	       0x1963713cc __psynch_cvwait + 8
1   libsystem_pthread.dylib       	       0x1963b00e0 _pthread_cond_wait + 984
2   Electron Framework            	       0x10dcaca44 uv_cond_wait + 12
3   Electron Framework            	       0x11490dd28 node::OnFatalError(char const*, char const*) + 435456
4   libsystem_pthread.dylib       	       0x1963afc0c _pthread_start + 136
5   libsystem_pthread.dylib       	       0x1963aab80 thread_start + 8


Thread 0 crashed with ARM Thread State (64-bit):
    x0: 0x2010002030300000   x1: 0x0000000fffffc110   x2: 0x40220a001c010000   x3: 0x000000010dedf588
    x4: 0x0000000000000000   x5: 0x00000000ffffffff   x6: 0x000000000000003b   x7: 0x0000000000000001
    x8: 0x0000000fffffc10c   x9: 0x2010002030300000  x10: 0x2010002030100000  x11: 0x0000011c000a2250
   x12: 0x0000000000000909  x13: 0x000000016b7ae287  x14: 0x0000000000000000  x15: 0x0000000000000109
   x16: 0x00000001963b09d4  x17: 0x0000012800360000  x18: 0x0000000000000000  x19: 0x00000001164ca2d8
   x20: 0x0000012800360128  x21: 0x0000000116478000  x22: 0x0000000116478000  x23: 0x0000011c00051501
   x24: 0x0000011c000514ec  x25: 0x0000000116589000  x26: 0x0000011c00080a30  x27: 0x7fffffffffffffef
   x28: 0x000000016b7ae940   fp: 0x000000016b7ae5e0   lr: 0x00000001121f1264
    sp: 0x000000016b7ae5e0   pc: 0x00000001963b0bdc cpsr: 0x20000000
   far: 0x0000000000000000  esr: 0xf2000001 (Breakpoint) brk 1

Binary Images:
       0x104650000 -        0x104653fff com.agentmax.desktop (1.0.0) <4c4c4426-5555-3144-a124-cbf4c6058dab> /Applications/Agent Max.app/Contents/MacOS/Agent Max
       0x10da50000 -        0x115ebbfff com.github.Electron.framework (*) <4c4c44f2-5555-3144-a156-83a0c22a3fad> /Applications/Agent Max.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework
       0x104690000 -        0x1046a3fff com.github.Squirrel (1.0) <4c4c4474-5555-3144-a1b8-ed23da2f9208> /Applications/Agent Max.app/Contents/Frameworks/Squirrel.framework/Versions/A/Squirrel
       0x104718000 -        0x104757fff com.electron.reactive (3.1.0) <4c4c44b8-5555-3144-a1d4-5ab3dd330485> /Applications/Agent Max.app/Contents/Frameworks/ReactiveObjC.framework/Versions/A/ReactiveObjC
       0x1046b8000 -        0x1046c3fff org.mantle.Mantle (1.0) <4c4c448f-5555-3144-a1c5-ce590ddf0f54> /Applications/Agent Max.app/Contents/Frameworks/Mantle.framework/Versions/A/Mantle
       0x104b54000 -        0x104d33fff libffmpeg.dylib (*) <4c4c44ff-5555-3144-a1cb-8afd5de4a299> /Applications/Agent Max.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries/libffmpeg.dylib
       0x1963a9000 -        0x1963b5a47 libsystem_pthread.dylib (*) <d6494ba9-171e-39fc-b1aa-28ecf87975d1> /usr/lib/system/libsystem_pthread.dylib
       0x196008000 -        0x1960a3577 dyld (*) <3247e185-ced2-36ff-9e29-47a77c23e004> /usr/lib/dyld
               0x0 - 0xffffffffffffffff ??? (*) <00000000-0000-0000-0000-000000000000> ???
       0x19636d000 -        0x1963a8653 libsystem_kernel.dylib (*) <6e4a96ad-04b8-3e8a-b91d-087e62306246> /usr/lib/system/libsystem_kernel.dylib

External Modification Summary:
  Calls made by other processes targeting this process:
    task_for_pid: 0
    thread_create: 0
    thread_set_state: 0
  Calls made by this process:
    task_for_pid: 0
    thread_create: 0
    thread_set_state: 0
  Calls made by all processes on this machine:
    task_for_pid: 0
    thread_create: 0
    thread_set_state: 0

VM Region Summary:
ReadOnly portion of Libraries: Total=1.8G resident=0K(0%) swapped_out_or_unallocated=1.8G(100%)
Writable regions: Total=207.9M written=497K(0%) resident=497K(0%) swapped_out=0K(0%) unallocated=207.4M(100%)

                                VIRTUAL   REGION 
REGION TYPE                        SIZE    COUNT (non-coalesced) 
===========                     =======  ======= 
Activity Tracing                   256K        1 
ColorSync                          416K       23 
CoreGraphics                        16K        1 
CoreServices                       304K        2 
Dispatch continuations            80.0M        1 
Kernel Alloc Once                   32K        1 
MALLOC                            22.4M       26 
MALLOC guard page                  288K       18 
Memory Tag 253                    32.0G      130 
Memory Tag 255                     1.1T        2 
Memory Tag 255 (reserved)           64K        1         reserved VM address space (unallocated)
STACK GUARD                       56.2M       14 
Stack                             89.7M       14 
VM_ALLOCATE                         32K        2 
__AUTH                            5368K      677 
__AUTH_CONST                      76.1M      919 
__CTF                               824        1 
__DATA                            31.0M      907 
__DATA_CONST                      32.6M      934 
__DATA_DIRTY                      2766K      339 
__FONT_DATA                        2352        1 
__INFO_FILTER                         8        1 
__LINKEDIT                       621.5M        7 
__OBJC_RO                         61.4M        1 
__OBJC_RW                         2396K        1 
__TEXT                             1.2G      953 
__TPRO_CONST                       128K        2 
mapped file                       70.2M       12 
page table in kernel               497K        1 
shared memory                      864K       13 
===========                     =======  ======= 
TOTAL                              1.1T     5005 
TOTAL, minus reserved VM space     1.1T     5005 



-----------
Full Report
-----------

{"app_name":"Agent Max","timestamp":"2025-11-03 06:47:10.00 -0500","app_version":"1.0.0","slice_uuid":"4c4c4426-5555-3144-a124-cbf4c6058dab","build_version":"1.0.0","platform":1,"bundleID":"com.agentmax.desktop","share_with_app_devs":0,"is_first_party":0,"bug_type":"309","os_version":"macOS 15.6 (24G84)","roots_installed":0,"name":"Agent Max","incident_id":"72672495-6710-46FE-9AB1-FB5A7BD60950"}
{
  "uptime" : 830000,
  "procRole" : "Foreground",
  "version" : 2,
  "userID" : 501,
  "deployVersion" : 210,
  "modelCode" : "Mac16,1",
  "coalitionID" : 212060,
  "osVersion" : {
    "train" : "macOS 15.6",
    "build" : "24G84",
    "releaseType" : "User"
  },
  "captureTime" : "2025-11-03 06:47:09.9185 -0500",
  "codeSigningMonitor" : 2,
  "incident" : "72672495-6710-46FE-9AB1-FB5A7BD60950",
  "pid" : 78226,
  "translated" : false,
  "cpuType" : "ARM-64",
  "roots_installed" : 0,
  "bug_type" : "309",
  "procLaunch" : "2025-11-03 06:47:07.9554 -0500",
  "procStartAbsTime" : 19998954658327,
  "procExitAbsTime" : 19999001759073,
  "procName" : "Agent Max",
  "procPath" : "\/Applications\/Agent Max.app\/Contents\/MacOS\/Agent Max",
  "bundleInfo" : {"CFBundleShortVersionString":"1.0.0","CFBundleVersion":"1.0.0","CFBundleIdentifier":"com.agentmax.desktop"},
  "storeInfo" : {"deviceIdentifierForVendor":"ECEEEF51-0C8B-59CA-8373-3EF9559583F4","thirdParty":true},
  "parentProc" : "launchd",
  "parentPid" : 1,
  "coalitionName" : "com.agentmax.desktop",
  "crashReporterKey" : "39FCB261-65C4-9496-3225-D347F930A398",
  "appleIntelligenceStatus" : {"state":"available"},
  "codeSigningID" : "com.agentmax.desktop",
  "codeSigningTeamID" : "Q3Q2BF22GL",
  "codeSigningFlags" : 570503953,
  "codeSigningValidationCategory" : 6,
  "codeSigningTrustLevel" : 4294967295,
  "codeSigningAuxiliaryInfo" : 0,
  "instructionByteStream" : {"beforePC":"4PIc1d8\/A9UBI5jy4f+\/8uEBwPIBAODyKABA+enyPNUfAQnrIPj\/VA==","atPC":"IAAg1OhPcLKIIZjyCAFAOR8BAHHgB58awANf1n8jA9X0T76p\/XsBqQ=="},
  "bootSessionUUID" : "A0343152-FD3B-4353-8E35-B3A330E78D98",
  "wakeTime" : 4263,
  "sleepWakeUUID" : "8AB60493-BC8A-40E5-A537-184816CD68CC",
  "sip" : "enabled",
  "exception" : {"codes":"0x0000000000000001, 0x00000001963b0bdc","rawCodes":[1,6815419356],"type":"EXC_BREAKPOINT","signal":"SIGTRAP"},
  "termination" : {"flags":0,"code":5,"namespace":"SIGNAL","indicator":"Trace\/BPT trap: 5","byProc":"exc handler","byPid":78226},
  "os_fault" : {"process":"Agent Max"},
  "extMods" : {"caller":{"thread_create":0,"thread_set_state":0,"task_for_pid":0},"system":{"thread_create":0,"thread_set_state":0,"task_for_pid":0},"targeted":{"thread_create":0,"thread_set_state":0,"task_for_pid":0},"warnings":0},
  "faultingThread" : 0,
  "threads" : [{"triggered":true,"id":19780327,"threadState":{"x":[{"value":2310346747088470016},{"value":68719460624},{"value":4621267163221655552},{"value":4528665992,"symbolLocation":11320,"symbol":"v8::internal::GetCurrentStackPosition()"},{"value":0},{"value":4294967295},{"value":59},{"value":1},{"value":68719460620},{"value":2310346747088470016},{"value":2310346747086372864},{"value":1219771376208},{"value":2313},{"value":6098182791},{"value":0},{"value":265},{"value":6815418836,"symbolLocation":0,"symbol":"pthread_jit_write_protect_np"},{"value":1271313858560},{"value":0},{"value":4669088472},{"value":1271313858856},{"value":4668751872,"symbolLocation":0,"symbol":"v8::internal::v8_flags"},{"value":4668751872,"symbolLocation":0,"symbol":"v8::internal::v8_flags"},{"value":1219771045121},{"value":1219771045100},{"value":4669870080},{"value":1219771238960},{"value":9223372036854775791},{"value":6098184512}],"flavor":"ARM_THREAD_STATE64","lr":{"value":4598993508},"cpsr":{"value":536870912},"fp":{"value":6098183648},"sp":{"value":6098183648},"esr":{"value":4060086273,"description":"(Breakpoint) brk 1"},"pc":{"value":6815419356,"matchesCrashFrame":1},"far":{"value":0}},"queue":"com.apple.main-thread","frames":[{"imageOffset":31708,"symbol":"pthread_jit_write_protect_np","symbolLocation":520,"imageIndex":6},{"imageOffset":75108964,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":36551932,"imageIndex":1},{"imageOffset":22406132,"symbol":"v8::internal::ThreadIsolation::Initialize(v8::ThreadIsolatedAllocator*)","symbolLocation":72,"imageIndex":1},{"imageOffset":24419472,"symbol":"v8::internal::V8::InitializePlatformForTesting(v8::Platform*)","symbolLocation":660,"imageIndex":1},{"imageOffset":21637368,"symbol":"v8::V8::Initialize(int)","symbolLocation":28,"imageIndex":1},{"imageOffset":76777188,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":38220156,"imageIndex":1},{"imageOffset":76766776,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":38209744,"imageIndex":1},{"imageOffset":3560444,"symbol":"v8::Signature::New(v8::Isolate*, v8::Local<v8::FunctionTemplate>)","symbolLocation":10376,"imageIndex":1},{"imageOffset":3559732,"symbol":"v8::Signature::New(v8::Isolate*, v8::Local<v8::FunctionTemplate>)","symbolLocation":9664,"imageIndex":1},{"imageOffset":3454808,"symbol":"v8::internal::compiler::SLVerifierHintParametersOf(v8::internal::compiler::Operator const*)","symbolLocation":68164,"imageIndex":1},{"imageOffset":40859196,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":2302164,"imageIndex":1},{"imageOffset":40873972,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":2316940,"imageIndex":1},{"imageOffset":40857520,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":2300488,"imageIndex":1},{"imageOffset":5845072,"symbol":"v8::internal::compiler::BasicBlock::set_loop_header(v8::internal::compiler::BasicBlock*)","symbolLocation":13948,"imageIndex":1},{"imageOffset":5849528,"symbol":"v8::internal::compiler::BasicBlock::set_loop_header(v8::internal::compiler::BasicBlock*)","symbolLocation":18404,"imageIndex":1},{"imageOffset":5849064,"symbol":"v8::internal::compiler::BasicBlock::set_loop_header(v8::internal::compiler::BasicBlock*)","symbolLocation":17940,"imageIndex":1},{"imageOffset":5843092,"symbol":"v8::internal::compiler::BasicBlock::set_loop_header(v8::internal::compiler::BasicBlock*)","symbolLocation":11968,"imageIndex":1},{"imageOffset":5843508,"symbol":"v8::internal::compiler::BasicBlock::set_loop_header(v8::internal::compiler::BasicBlock*)","symbolLocation":12384,"imageIndex":1},{"imageOffset":2499312,"symbol":"ElectronMain","symbolLocation":128,"imageIndex":1},{"imageOffset":27544,"symbol":"start","symbolLocation":6076,"imageIndex":7}]},{"id":19780360,"frames":[{"imageOffset":7020,"symbol":"start_wqthread","symbolLocation":0,"imageIndex":6}],"threadState":{"x":[{"value":6098743296},{"value":4355},{"value":6098206720},{"value":0},{"value":409604},{"value":18446744073709551615},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0}],"flavor":"ARM_THREAD_STATE64","lr":{"value":0},"cpsr":{"value":0},"fp":{"value":0},"sp":{"value":6098743296},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":6815394668},"far":{"value":0}}},{"id":19780361,"frames":[{"imageOffset":7020,"symbol":"start_wqthread","symbolLocation":0,"imageIndex":6}],"threadState":{"x":[{"value":6099316736},{"value":5123},{"value":6098780160},{"value":0},{"value":409602},{"value":18446744073709551615},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0}],"flavor":"ARM_THREAD_STATE64","lr":{"value":0},"cpsr":{"value":0},"fp":{"value":0},"sp":{"value":6099316736},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":6815394668},"far":{"value":0}}},{"id":19780369,"frames":[{"imageOffset":7020,"symbol":"start_wqthread","symbolLocation":0,"imageIndex":6}],"threadState":{"x":[{"value":6099890176},{"value":0},{"value":6099353600},{"value":0},{"value":278532},{"value":18446744073709551615},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0},{"value":0}],"flavor":"ARM_THREAD_STATE64","lr":{"value":0},"cpsr":{"value":0},"fp":{"value":0},"sp":{"value":6099890176},"esr":{"value":0,"description":" Address size fault"},"pc":{"value":6815394668},"far":{"value":0}}},{"id":19780374,"name":"ThreadPoolServiceThread","threadState":{"x":[{"value":4},{"value":0},{"value":0},{"value":1271317429472},{"value":1},{"value":0},{"value":0},{"value":2240044497},{"value":0},{"value":0},{"value":0},{"value":2},{"value":4669347816},{"value":26627},{"value":0},{"value":0},{"value":369},{"value":6108884992},{"value":0},{"value":1271314351440},{"value":1271313473344},{"value":0},{"value":6108884272},{"value":12297829382473034411},{"value":12297829382473034410},{"value":0},{"value":0},{"value":0},{"value":0}],"flavor":"ARM_THREAD_STATE64","lr":{"value":4580458236},"cpsr":{"value":2684354560},"fp":{"value":6108884256},"sp":{"value":6108884048},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":6815193436},"far":{"value":0}},"frames":[{"imageOffset":51548,"symbol":"kevent64","symbolLocation":8,"imageIndex":9},{"imageOffset":56573692,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":18016660,"imageIndex":1},{"imageOffset":56571696,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":18014664,"imageIndex":1},{"imageOffset":56233904,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17676872,"imageIndex":1},{"imageOffset":55999384,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17442352,"imageIndex":1},{"imageOffset":56369596,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17812564,"imageIndex":1},{"imageOffset":56273748,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17716716,"imageIndex":1},{"imageOffset":56369916,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17812884,"imageIndex":1},{"imageOffset":56449552,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17892520,"imageIndex":1},{"imageOffset":27660,"symbol":"_pthread_start","symbolLocation":136,"imageIndex":6},{"imageOffset":7040,"symbol":"thread_start","symbolLocation":8,"imageIndex":6}]},{"id":19780375,"name":"ThreadPoolForegroundWorker","threadState":{"x":[{"value":268451845},{"value":17179869442},{"value":0},{"value":116561117446144},{"value":0},{"value":116561117446144},{"value":32},{"value":1000},{"value":0},{"value":17179869184},{"value":32},{"value":0},{"value":0},{"value":0},{"value":27139},{"value":3},{"value":18446744073709551569},{"value":1271313865728},{"value":0},{"value":1000},{"value":32},{"value":116561117446144},{"value":0},{"value":116561117446144},{"value":6117305648},{"value":0},{"value":17179870466},{"value":18446744073709550527},{"value":1282}],"flavor":"ARM_THREAD_STATE64","lr":{"value":6815220640},"cpsr":{"value":0},"fp":{"value":6117304992},"sp":{"value":6117304912},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":6815145012},"far":{"value":0}},"frames":[{"imageOffset":3124,"symbol":"mach_msg2_trap","symbolLocation":8,"imageIndex":9},{"imageOffset":78752,"symbol":"mach_msg2_internal","symbolLocation":76,"imageIndex":9},{"imageOffset":38756,"symbol":"mach_msg_overwrite","symbolLocation":484,"imageIndex":9},{"imageOffset":4008,"symbol":"mach_msg","symbolLocation":24,"imageIndex":9},{"imageOffset":56545724,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17988692,"imageIndex":1},{"imageOffset":56097976,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17540944,"imageIndex":1},{"imageOffset":56342468,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17785436,"imageIndex":1},{"imageOffset":56340784,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17783752,"imageIndex":1},{"imageOffset":56340488,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17783456,"imageIndex":1},{"imageOffset":56449552,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17892520,"imageIndex":1},{"imageOffset":27660,"symbol":"_pthread_start","symbolLocation":136,"imageIndex":6},{"imageOffset":7040,"symbol":"thread_start","symbolLocation":8,"imageIndex":6}]},{"id":19780376,"name":"ThreadPoolBackgroundWorker","threadState":{"x":[{"value":268451845},{"value":17179869442},{"value":0},{"value":124274878709760},{"value":0},{"value":124274878709760},{"value":32},{"value":1000},{"value":0},{"value":17179869184},{"value":32},{"value":0},{"value":0},{"value":0},{"value":28935},{"value":8660567824,"symbolLocation":0,"symbol":"__CFConstantStringClassReference"},{"value":18446744073709551569},{"value":1271313868800},{"value":0},{"value":1000},{"value":32},{"value":124274878709760},{"value":0},{"value":124274878709760},{"value":6125726944},{"value":0},{"value":17179870466},{"value":18446744073709550527},{"value":1282}],"flavor":"ARM_THREAD_STATE64","lr":{"value":6815220640},"cpsr":{"value":0},"fp":{"value":6125726288},"sp":{"value":6125726208},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":6815145012},"far":{"value":0}},"frames":[{"imageOffset":3124,"symbol":"mach_msg2_trap","symbolLocation":8,"imageIndex":9},{"imageOffset":78752,"symbol":"mach_msg2_internal","symbolLocation":76,"imageIndex":9},{"imageOffset":38756,"symbol":"mach_msg_overwrite","symbolLocation":484,"imageIndex":9},{"imageOffset":4008,"symbol":"mach_msg","symbolLocation":24,"imageIndex":9},{"imageOffset":56545724,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17988692,"imageIndex":1},{"imageOffset":56097976,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17540944,"imageIndex":1},{"imageOffset":56338712,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17781680,"imageIndex":1},{"imageOffset":56341108,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17784076,"imageIndex":1},{"imageOffset":56340652,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17783620,"imageIndex":1},{"imageOffset":56340540,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17783508,"imageIndex":1},{"imageOffset":56449552,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17892520,"imageIndex":1},{"imageOffset":27660,"symbol":"_pthread_start","symbolLocation":136,"imageIndex":6},{"imageOffset":7040,"symbol":"thread_start","symbolLocation":8,"imageIndex":6}]},{"id":19780377,"name":"ThreadPoolForegroundWorker","threadState":{"x":[{"value":268451845},{"value":17179869442},{"value":0},{"value":123175367081984},{"value":0},{"value":123175367081984},{"value":32},{"value":1000},{"value":0},{"value":17179869184},{"value":32},{"value":0},{"value":0},{"value":0},{"value":28679},{"value":8660567824,"symbolLocation":0,"symbol":"__CFConstantStringClassReference"},{"value":18446744073709551569},{"value":1271313869824},{"value":0},{"value":1000},{"value":32},{"value":123175367081984},{"value":0},{"value":123175367081984},{"value":6134148320},{"value":0},{"value":17179870466},{"value":18446744073709550527},{"value":1282}],"flavor":"ARM_THREAD_STATE64","lr":{"value":6815220640},"cpsr":{"value":0},"fp":{"value":6134147664},"sp":{"value":6134147584},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":6815145012},"far":{"value":0}},"frames":[{"imageOffset":3124,"symbol":"mach_msg2_trap","symbolLocation":8,"imageIndex":9},{"imageOffset":78752,"symbol":"mach_msg2_internal","symbolLocation":76,"imageIndex":9},{"imageOffset":38756,"symbol":"mach_msg_overwrite","symbolLocation":484,"imageIndex":9},{"imageOffset":4008,"symbol":"mach_msg","symbolLocation":24,"imageIndex":9},{"imageOffset":56545724,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17988692,"imageIndex":1},{"imageOffset":56097976,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17540944,"imageIndex":1},{"imageOffset":56338712,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17781680,"imageIndex":1},{"imageOffset":56341108,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17784076,"imageIndex":1},{"imageOffset":56340784,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17783752,"imageIndex":1},{"imageOffset":56340488,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17783456,"imageIndex":1},{"imageOffset":56449552,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17892520,"imageIndex":1},{"imageOffset":27660,"symbol":"_pthread_start","symbolLocation":136,"imageIndex":6},{"imageOffset":7040,"symbol":"thread_start","symbolLocation":8,"imageIndex":6}]},{"id":19780378,"name":"Chrome_IOThread","threadState":{"x":[{"value":4},{"value":0},{"value":0},{"value":1271317435904},{"value":1},{"value":0},{"value":0},{"value":2240044497},{"value":0},{"value":0},{"value":0},{"value":2},{"value":4669347864},{"value":42755},{"value":0},{"value":0},{"value":369},{"value":6142570496},{"value":0},{"value":1271314342480},{"value":1271313481344},{"value":0},{"value":6142569760},{"value":12297829382473034411},{"value":12297829382473034410},{"value":0},{"value":0},{"value":0},{"value":0}],"flavor":"ARM_THREAD_STATE64","lr":{"value":4580458236},"cpsr":{"value":2684354560},"fp":{"value":6142569744},"sp":{"value":6142569536},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":6815193436},"far":{"value":0}},"frames":[{"imageOffset":51548,"symbol":"kevent64","symbolLocation":8,"imageIndex":9},{"imageOffset":56573692,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":18016660,"imageIndex":1},{"imageOffset":56571696,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":18014664,"imageIndex":1},{"imageOffset":56233904,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17676872,"imageIndex":1},{"imageOffset":55999384,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17442352,"imageIndex":1},{"imageOffset":56369596,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17812564,"imageIndex":1},{"imageOffset":40877516,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":2320484,"imageIndex":1},{"imageOffset":56369916,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17812884,"imageIndex":1},{"imageOffset":56449552,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17892520,"imageIndex":1},{"imageOffset":27660,"symbol":"_pthread_start","symbolLocation":136,"imageIndex":6},{"imageOffset":7040,"symbol":"thread_start","symbolLocation":8,"imageIndex":6}]},{"id":19780379,"name":"MemoryInfra","threadState":{"x":[{"value":268451845},{"value":17179869186},{"value":0},{"value":180332791857152},{"value":0},{"value":180332791857152},{"value":32},{"value":0},{"value":0},{"value":17179869184},{"value":32},{"value":0},{"value":0},{"value":0},{"value":41987},{"value":128},{"value":18446744073709551569},{"value":6150991872},{"value":0},{"value":0},{"value":32},{"value":180332791857152},{"value":0},{"value":180332791857152},{"value":6150990896},{"value":0},{"value":17179869186},{"value":18446744073709550527},{"value":2}],"flavor":"ARM_THREAD_STATE64","lr":{"value":6815220640},"cpsr":{"value":0},"fp":{"value":6150990240},"sp":{"value":6150990160},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":6815145012},"far":{"value":0}},"frames":[{"imageOffset":3124,"symbol":"mach_msg2_trap","symbolLocation":8,"imageIndex":9},{"imageOffset":78752,"symbol":"mach_msg2_internal","symbolLocation":76,"imageIndex":9},{"imageOffset":38756,"symbol":"mach_msg_overwrite","symbolLocation":484,"imageIndex":9},{"imageOffset":4008,"symbol":"mach_msg","symbolLocation":24,"imageIndex":9},{"imageOffset":56545724,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17988692,"imageIndex":1},{"imageOffset":56097684,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17540652,"imageIndex":1},{"imageOffset":55837316,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17280284,"imageIndex":1},{"imageOffset":56233904,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17676872,"imageIndex":1},{"imageOffset":55999384,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17442352,"imageIndex":1},{"imageOffset":56369596,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17812564,"imageIndex":1},{"imageOffset":56369916,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17812884,"imageIndex":1},{"imageOffset":56449552,"symbol":"node::GetArrayBufferAllocator(node::IsolateData*)","symbolLocation":17892520,"imageIndex":1},{"imageOffset":27660,"symbol":"_pthread_start","symbolLocation":136,"imageIndex":6},{"imageOffset":7040,"symbol":"thread_start","symbolLocation":8,"imageIndex":6}]},{"id":19780383,"frames":[{"imageOffset":27908,"symbol":"kevent","symbolLocation":8,"imageIndex":9},{"imageOffset":2497848,"symbol":"uv_free_interface_addresses","symbolLocation":2180,"imageIndex":1},{"imageOffset":2429032,"symbol":"uv_run","symbolLocation":272,"imageIndex":1},{"imageOffset":116129200,"symbol":"node::OnFatalError(char const*, char const*)","symbolLocation":443784,"imageIndex":1},{"imageOffset":27660,"symbol":"_pthread_start","symbolLocation":136,"imageIndex":6},{"imageOffset":7040,"symbol":"thread_start","symbolLocation":8,"imageIndex":6}],"threadState":{"x":[{"value":4},{"value":0},{"value":2},{"value":6159380080},{"value":1024},{"value":0},{"value":0},{"value":0},{"value":6159380032},{"value":1637542848},{"value":6159380112},{"value":23},{"value":1219773402504},{"value":0},{"value":0},{"value":0},{"value":363},{"value":8677602888},{"value":0},{"value":73728},{"value":1219773402344},{"value":0},{"value":2863311530},{"value":2},{"value":65531},{"value":4294967295},{"value":6159380080},{"value":1},{"value":1219773402880}],"flavor":"ARM_THREAD_STATE64","lr":{"value":4526382392},"cpsr":{"value":1610612736},"fp":{"value":6159412944},"sp":{"value":6159379952},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":6815169796},"far":{"value":0}}},{"id":19780384,"frames":[{"imageOffset":17356,"symbol":"__psynch_cvwait","symbolLocation":8,"imageIndex":9},{"imageOffset":28896,"symbol":"_pthread_cond_wait","symbolLocation":984,"imageIndex":6},{"imageOffset":2476612,"symbol":"uv_cond_wait","symbolLocation":12,"imageIndex":1},{"imageOffset":116120872,"symbol":"node::OnFatalError(char const*, char const*)","symbolLocation":435456,"imageIndex":1},{"imageOffset":27660,"symbol":"_pthread_start","symbolLocation":136,"imageIndex":6},{"imageOffset":7040,"symbol":"thread_start","symbolLocation":8,"imageIndex":6}],"threadState":{"x":[{"value":4},{"value":0},{"value":0},{"value":0},{"value":0},{"value":160},{"value":0},{"value":0},{"value":6167834296},{"value":0},{"value":0},{"value":2},{"value":2},{"value":0},{"value":0},{"value":0},{"value":305},{"value":8677594384},{"value":0},{"value":1219772418328},{"value":1219772418392},{"value":6167834848},{"value":0},{"value":0},{"value":0},{"value":1},{"value":256},{"value":0},{"value":0}],"flavor":"ARM_THREAD_STATE64","lr":{"value":6815416544},"cpsr":{"value":1610612736},"fp":{"value":6167834416},"sp":{"value":6167834272},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":6815159244},"far":{"value":0}}},{"id":19780385,"frames":[{"imageOffset":17356,"symbol":"__psynch_cvwait","symbolLocation":8,"imageIndex":9},{"imageOffset":28896,"symbol":"_pthread_cond_wait","symbolLocation":984,"imageIndex":6},{"imageOffset":2476612,"symbol":"uv_cond_wait","symbolLocation":12,"imageIndex":1},{"imageOffset":116120872,"symbol":"node::OnFatalError(char const*, char const*)","symbolLocation":435456,"imageIndex":1},{"imageOffset":27660,"symbol":"_pthread_start","symbolLocation":136,"imageIndex":6},{"imageOffset":7040,"symbol":"thread_start","symbolLocation":8,"imageIndex":6}],"threadState":{"x":[{"value":4},{"value":0},{"value":0},{"value":0},{"value":0},{"value":160},{"value":0},{"value":0},{"value":6176255672},{"value":0},{"value":0},{"value":2},{"value":2},{"value":0},{"value":0},{"value":0},{"value":305},{"value":8677594384},{"value":0},{"value":1219772418328},{"value":1219772418392},{"value":6176256224},{"value":0},{"value":0},{"value":0},{"value":0},{"value":768},{"value":0},{"value":0}],"flavor":"ARM_THREAD_STATE64","lr":{"value":6815416544},"cpsr":{"value":1610612736},"fp":{"value":6176255792},"sp":{"value":6176255648},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":6815159244},"far":{"value":0}}},{"id":19780386,"frames":[{"imageOffset":17356,"symbol":"__psynch_cvwait","symbolLocation":8,"imageIndex":9},{"imageOffset":28896,"symbol":"_pthread_cond_wait","symbolLocation":984,"imageIndex":6},{"imageOffset":2476612,"symbol":"uv_cond_wait","symbolLocation":12,"imageIndex":1},{"imageOffset":116120872,"symbol":"node::OnFatalError(char const*, char const*)","symbolLocation":435456,"imageIndex":1},{"imageOffset":27660,"symbol":"_pthread_start","symbolLocation":136,"imageIndex":6},{"imageOffset":7040,"symbol":"thread_start","symbolLocation":8,"imageIndex":6}],"threadState":{"x":[{"value":260},{"value":0},{"value":0},{"value":0},{"value":0},{"value":160},{"value":0},{"value":0},{"value":6184677048},{"value":0},{"value":0},{"value":2},{"value":2},{"value":0},{"value":0},{"value":0},{"value":305},{"value":8677594384},{"value":0},{"value":1219772418328},{"value":1219772418392},{"value":6184677600},{"value":0},{"value":0},{"value":0},{"value":0},{"value":512},{"value":0},{"value":0}],"flavor":"ARM_THREAD_STATE64","lr":{"value":6815416544},"cpsr":{"value":1610612736},"fp":{"value":6184677168},"sp":{"value":6184677024},"esr":{"value":1442840704,"description":" Address size fault"},"pc":{"value":6815159244},"far":{"value":0}}}],
  "usedImages" : [
  {
    "source" : "P",
    "arch" : "arm64",
    "base" : 4368695296,
    "CFBundleShortVersionString" : "1.0.0",
    "CFBundleIdentifier" : "com.agentmax.desktop",
    "size" : 16384,
    "uuid" : "4c4c4426-5555-3144-a124-cbf4c6058dab",
    "path" : "\/Applications\/Agent Max.app\/Contents\/MacOS\/Agent Max",
    "name" : "Agent Max",
    "CFBundleVersion" : "1.0.0"
  },
  {
    "source" : "P",
    "arch" : "arm64",
    "base" : 4523884544,
    "CFBundleIdentifier" : "com.github.Electron.framework",
    "size" : 138854400,
    "uuid" : "4c4c44f2-5555-3144-a156-83a0c22a3fad",
    "path" : "\/Applications\/Agent Max.app\/Contents\/Frameworks\/Electron Framework.framework\/Versions\/A\/Electron Framework",
    "name" : "Electron Framework",
    "CFBundleVersion" : "28.3.3"
  },
  {
    "source" : "P",
    "arch" : "arm64",
    "base" : 4368957440,
    "CFBundleShortVersionString" : "1.0",
    "CFBundleIdentifier" : "com.github.Squirrel",
    "size" : 81920,
    "uuid" : "4c4c4474-5555-3144-a1b8-ed23da2f9208",
    "path" : "\/Applications\/Agent Max.app\/Contents\/Frameworks\/Squirrel.framework\/Versions\/A\/Squirrel",
    "name" : "Squirrel",
    "CFBundleVersion" : "1"
  },
  {
    "source" : "P",
    "arch" : "arm64",
    "base" : 4369514496,
    "CFBundleShortVersionString" : "3.1.0",
    "CFBundleIdentifier" : "com.electron.reactive",
    "size" : 262144,
    "uuid" : "4c4c44b8-5555-3144-a1d4-5ab3dd330485",
    "path" : "\/Applications\/Agent Max.app\/Contents\/Frameworks\/ReactiveObjC.framework\/Versions\/A\/ReactiveObjC",
    "name" : "ReactiveObjC",
    "CFBundleVersion" : "0.0.0"
  },
  {
    "source" : "P",
    "arch" : "arm64",
    "base" : 4369121280,
    "CFBundleShortVersionString" : "1.0",
    "CFBundleIdentifier" : "org.mantle.Mantle",
    "size" : 49152,
    "uuid" : "4c4c448f-5555-3144-a1c5-ce590ddf0f54",
    "path" : "\/Applications\/Agent Max.app\/Contents\/Frameworks\/Mantle.framework\/Versions\/A\/Mantle",
    "name" : "Mantle",
    "CFBundleVersion" : "0.0.0"
  },
  {
    "source" : "P",
    "arch" : "arm64",
    "base" : 4373954560,
    "size" : 1966080,
    "uuid" : "4c4c44ff-5555-3144-a1cb-8afd5de4a299",
    "path" : "\/Applications\/Agent Max.app\/Contents\/Frameworks\/Electron Framework.framework\/Versions\/A\/Libraries\/libffmpeg.dylib",
    "name" : "libffmpeg.dylib"
  },
  {
    "source" : "P",
    "arch" : "arm64e",
    "base" : 6815387648,
    "size" : 51784,
    "uuid" : "d6494ba9-171e-39fc-b1aa-28ecf87975d1",
    "path" : "\/usr\/lib\/system\/libsystem_pthread.dylib",
    "name" : "libsystem_pthread.dylib"
  },
  {
    "source" : "P",
    "arch" : "arm64e",
    "base" : 6811582464,
    "size" : 636280,
    "uuid" : "3247e185-ced2-36ff-9e29-47a77c23e004",
    "path" : "\/usr\/lib\/dyld",
    "name" : "dyld"
  },
  {
    "size" : 0,
    "source" : "A",
    "base" : 0,
    "uuid" : "00000000-0000-0000-0000-000000000000"
  },
  {
    "source" : "P",
    "arch" : "arm64e",
    "base" : 6815141888,
    "size" : 243284,
    "uuid" : "6e4a96ad-04b8-3e8a-b91d-087e62306246",
    "path" : "\/usr\/lib\/system\/libsystem_kernel.dylib",
    "name" : "libsystem_kernel.dylib"
  }
],
  "sharedCache" : {
  "base" : 6810746880,
  "size" : 5040898048,
  "uuid" : "032c7bce-a479-35b8-97bc-ce7f8f80ccab"
},
  "vmSummary" : "ReadOnly portion of Libraries: Total=1.8G resident=0K(0%) swapped_out_or_unallocated=1.8G(100%)\nWritable regions: Total=207.9M written=497K(0%) resident=497K(0%) swapped_out=0K(0%) unallocated=207.4M(100%)\n\n                                VIRTUAL   REGION \nREGION TYPE                        SIZE    COUNT (non-coalesced) \n===========                     =======  ======= \nActivity Tracing                   256K        1 \nColorSync                          416K       23 \nCoreGraphics                        16K        1 \nCoreServices                       304K        2 \nDispatch continuations            80.0M        1 \nKernel Alloc Once                   32K        1 \nMALLOC                            22.4M       26 \nMALLOC guard page                  288K       18 \nMemory Tag 253                    32.0G      130 \nMemory Tag 255                     1.1T        2 \nMemory Tag 255 (reserved)           64K        1         reserved VM address space (unallocated)\nSTACK GUARD                       56.2M       14 \nStack                             89.7M       14 \nVM_ALLOCATE                         32K        2 \n__AUTH                            5368K      677 \n__AUTH_CONST                      76.1M      919 \n__CTF                               824        1 \n__DATA                            31.0M      907 \n__DATA_CONST                      32.6M      934 \n__DATA_DIRTY                      2766K      339 \n__FONT_DATA                        2352        1 \n__INFO_FILTER                         8        1 \n__LINKEDIT                       621.5M        7 \n__OBJC_RO                         61.4M        1 \n__OBJC_RW                         2396K        1 \n__TEXT                             1.2G      953 \n__TPRO_CONST                       128K        2 \nmapped file                       70.2M       12 \npage table in kernel               497K        1 \nshared memory                      864K       13 \n===========                     =======  ======= \nTOTAL                              1.1T     5005 \nTOTAL, minus reserved VM space     1.1T     5005 \n",
  "legacyInfo" : {
  "threadTriggered" : {
    "queue" : "com.apple.main-thread"
  }
},
  "logWritingSignature" : "e5ec84c98f22825c4b0e8ae83af20f4284644a19",
  "trialInfo" : {
  "rollouts" : [
    {
      "rolloutId" : "645eb1d0417dab722a215927",
      "factorPackIds" : {

      },
      "deploymentId" : 240000005
    },
    {
      "rolloutId" : "648cada15dbc71671bb3aa1b",
      "factorPackIds" : {
        "SIRI_EXPERIENCE_CAM" : "65a81173096f6a1f1ba46525"
      },
      "deploymentId" : 240000116
    }
  ],
  "experiments" : [

  ]
}
}

Model: Mac16,1, BootROM 11881.140.96, proc 10:4:6 processors, 16 GB, SMC 
Graphics: Apple M4, Apple M4, Built-In
Display: Color LCD, 3024 x 1964 Retina, Main, MirrorOff, Online
Memory Module: LPDDR5, Micron
AirPort: spairport_wireless_card_type_wifi (0x14E4, 0x4388), wl0: Jun 24 2025 04:56:40 version 23.40.31.0.41.51.179 FWID 01-435c4c4d
IO80211_driverkit-1485.7 "IO80211_driverkit-1485.7" Jul 15 2025 20:46:41
AirPort: 
Bluetooth: Version (null), 0 services, 0 devices, 0 incoming serial ports
Network Service: Wi-Fi, AirPort, en0
USB Device: USB31Bus
USB Device: USB31Bus
USB Device: USB31Bus
Thunderbolt Bus: MacBook Pro, Apple Inc.
Thunderbolt Bus: MacBook Pro, Apple Inc.
Thunderbolt Bus: MacBook Pro, Apple Inc.
