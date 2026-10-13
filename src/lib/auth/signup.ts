/** Signup form validation, shared by the form and the server action. */
export const STATES =
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA PR RI SC SD TN TX UT VT VA WA WV WI WY".split(
    " ",
  );

export type SignupInput = {
  firstName: string;
  lastName: string;
  nickname: string;
  useNickname: boolean;
  phone: string;
  city: string;
  state: string;
  birthday: string;
  foundUs: string;
  referral: string;
  pin: string;
  pin2: string;
};

export function age(birthday: string, today = new Date()): number {
  const b = new Date(`${birthday}T00:00:00Z`);
  let a = today.getUTCFullYear() - b.getUTCFullYear();
  const m = today.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < b.getUTCDate())) a--;
  return a;
}

/** Returns the first problem, or null when the form is valid. */
export function checkSignup(f: SignupInput, today = new Date()): string | null {
  if (!f.firstName.trim() || f.firstName.length > 40)
    return "Enter your first name.";
  if (!f.lastName.trim() || f.lastName.length > 40)
    return "Enter your last name.";
  if (f.nickname.length > 30) return "Nicknames can be up to 30 characters.";
  if (f.useNickname && !f.nickname.trim())
    return "Add a nickname or turn off “use it as my name”.";
  if (f.phone && !/^\+?[0-9]{10,15}$/.test(f.phone.replace(/[\s().-]/g, "")))
    return "Enter a 10-digit phone number, or leave it blank.";
  if (!f.city.trim() || f.city.length > 60) return "Enter your city.";
  if (!STATES.includes(f.state)) return "Pick your state.";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(f.birthday) ||
    Number.isNaN(Date.parse(f.birthday))
  )
    return "Enter your birthday.";
  if (age(f.birthday, today) < 18) return "You must be 18 or older to join.";
  if (f.foundUs.length > 200)
    return "Keep “how you found us” under 200 characters.";
  if (f.referral && !/^\d{6}$/.test(f.referral))
    return "Referral codes are 6 digits.";
  if (!/^\d{4}$/.test(f.pin)) return "Your PIN must be 4 digits.";
  if (f.pin !== f.pin2) return "The two PINs don't match.";
  return null;
}
