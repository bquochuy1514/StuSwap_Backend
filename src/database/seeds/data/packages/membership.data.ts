import { MembershipType } from 'src/modules/users/enums/membership.enum';

export const membershipPackages = [
  {
    key: 'membership_basic_30d',
    package_type: 'MEMBERSHIP' as const,
    display_name: 'Gói Cơ bản - 30 ngày',
    description:
      'Trở thành thành viên trong 30 ngày với khả năng đăng tối đa 20 tin, ưu đãi cơ bản cho người dùng mới.',
    price: 30000, // ~~ 2k/tin
    is_active: true,
    promotion_type: null,
    priority_level: null,
    duration_hours: null,
    extend_days: null,
    membership_days: 30,
    max_posts: 15,
    membership_type: MembershipType.BASIC,
  },
  {
    key: 'membership_premium_30d',
    package_type: 'MEMBERSHIP' as const,
    display_name: 'Gói Premium - 30 ngày',
    description:
      'Gói cao cấp 30 ngày: Đăng tối đa 40 tin, nhận nhiều ưu đãi độc quyền.',
    price: 60000, // 40 tin ~ 1.5k / tin
    is_active: true,
    promotion_type: null,
    priority_level: null,
    duration_hours: null,
    extend_days: null,
    membership_days: 30,
    max_posts: 40,
    membership_type: MembershipType.PREMIUM,
  },
  {
    key: 'membership_premium_90d',
    package_type: 'MEMBERSHIP' as const,
    display_name: 'Gói Premium - 90 ngày',
    description:
      'Gói Premium 3 tháng tiết kiệm: Đăng tối đa 120 tin, hỗ trợ ưu tiên từ hệ thống.',
    price: 150000,
    is_active: true,
    promotion_type: null,
    priority_level: null,
    duration_hours: null,
    extend_days: null,
    membership_days: 90,
    max_posts: 120,
    membership_type: MembershipType.PREMIUM,
  },
  {
    key: 'membership_vip_30d',
    package_type: 'MEMBERSHIP' as const,
    display_name: 'Gói VIP - 30 ngày',
    description:
      'Gói VIP đặc biệt: Đăng số lượng lớn tin, hỗ trợ ưu tiên 24/7 và nhiều đặc quyền.',
    price: 120000,
    is_active: true,
    promotion_type: null,
    priority_level: null,
    duration_hours: null,
    extend_days: null,
    membership_days: 30,
    max_posts: 200,
    membership_type: MembershipType.VIP,
  },
];
