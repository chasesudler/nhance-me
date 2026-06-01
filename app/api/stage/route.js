import { NextResponse } from 'next/server';
export async function POST(request){
  const body = await request.json().catch(()=>({}));
  return NextResponse.json({
    ok:true,
    mode:'demo',
    message:'Virtual staging API route is ready for a production staging model.',
    request:{room:body.room,style:body.style,density:body.density},
    guardrails:['mark as virtually staged','do not alter permanent property features','avoid hiding damage','preserve windows, doors, flooring, walls']
  });
}
